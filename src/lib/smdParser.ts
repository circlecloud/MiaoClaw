import * as THREE from "three";

/**
 * SMD (StudioMdl Data) 解析器
 * 解析 Source Engine 的 SMD 格式，返回 Three.js 可用的数据
 */

export interface SMDBone {
  id: number;
  name: string;
  parentId: number;
}

export interface SMDKeyframe {
  boneId: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

export interface SMDFrame {
  time: number;
  keyframes: SMDKeyframe[];
}

export interface SMDVertex {
  boneId: number;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  uv: THREE.Vector2;
  weights: { boneId: number; weight: number }[];
}

export interface SMDTriangle {
  material: string;
  vertices: [SMDVertex, SMDVertex, SMDVertex];
}

export interface SMDData {
  bones: SMDBone[];
  frames: SMDFrame[];
  triangles: SMDTriangle[];
}

type Section = "none" | "nodes" | "skeleton" | "triangles";

export function parseSMD(content: string): SMDData {
  const bones: SMDBone[] = [];
  const frames: SMDFrame[] = [];
  const triangles: SMDTriangle[] = [];

  const lines = content.split("\n");
  let section: Section = "none";
  let currentFrame: SMDFrame | null = null;
  let currentMaterial = "";
  let triVerts: SMDVertex[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === "version 1") continue;

    if (line === "nodes") { section = "nodes"; continue; }
    if (line === "skeleton") { section = "skeleton"; continue; }
    if (line === "triangles") { section = "triangles"; continue; }
    if (line === "end") {
      if (section === "skeleton" && currentFrame) {
        frames.push(currentFrame);
        currentFrame = null;
      }
      section = "none";
      continue;
    }

    if (section === "nodes") {
      const match = line.match(/^(\d+)\s+"([^"]+)"\s+(-?\d+)/);
      if (match) {
        bones.push({
          id: parseInt(match[1]),
          name: match[2],
          parentId: parseInt(match[3]),
        });
      }
    } else if (section === "skeleton") {
      if (line.startsWith("time ")) {
        if (currentFrame) frames.push(currentFrame);
        currentFrame = { time: parseInt(line.split(" ")[1]), keyframes: [] };
      } else if (currentFrame) {
        const parts = line.split(/\s+/).map(Number);
        if (parts.length >= 7) {
          currentFrame.keyframes.push({
            boneId: parts[0],
            position: new THREE.Vector3(parts[1], parts[2], parts[3]),
            rotation: new THREE.Euler(parts[4], parts[5], parts[6], "XYZ"),
          });
        }
      }
    } else if (section === "triangles") {
      if (triVerts.length === 3) {
        triangles.push({
          material: currentMaterial,
          vertices: [triVerts[0], triVerts[1], triVerts[2]],
        });
        triVerts = [];
      }

      if (triVerts.length === 0 && !line.match(/^\s*\d/)) {
        currentMaterial = line;
        continue;
      }

      const parts = line.split(/\s+/).map(Number);
      if (parts.length >= 9) {
        const weights: { boneId: number; weight: number }[] = [];
        if (parts.length > 9) {
          const numWeights = parts[9];
          for (let w = 0; w < numWeights; w++) {
            weights.push({
              boneId: parts[10 + w * 2],
              weight: parts[11 + w * 2],
            });
          }
        } else {
          weights.push({ boneId: parts[0], weight: 1.0 });
        }

        triVerts.push({
          boneId: parts[0],
          position: new THREE.Vector3(parts[1], parts[2], parts[3]),
          normal: new THREE.Vector3(parts[4], parts[5], parts[6]),
          uv: new THREE.Vector2(parts[7], parts[8]),
          weights,
        });
      }
    }
  }

  // 最后一组三角形
  if (triVerts.length === 3) {
    triangles.push({
      material: currentMaterial,
      vertices: [triVerts[0], triVerts[1], triVerts[2]],
    });
  }

  return { bones, frames, triangles };
}

/**
 * 从 SMD 数据构建 Three.js SkinnedMesh
 */
export function buildSkinnedMesh(
  smd: SMDData,
  texture: THREE.Texture,
  scale: number,
): { mesh: THREE.SkinnedMesh; skeleton: THREE.Skeleton } {
  const geometry = new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];

  for (const tri of smd.triangles) {
    for (const vert of tri.vertices) {
      positions.push(vert.position.x * scale, vert.position.y * scale, vert.position.z * scale);
      normals.push(vert.normal.x, vert.normal.y, vert.normal.z);
      uvs.push(vert.uv.x, 1.0 - vert.uv.y); // SMD UV Y 翻转

      // 最多 4 个骨骼权重
      const w = vert.weights.slice(0, 4);
      while (w.length < 4) w.push({ boneId: 0, weight: 0 });
      skinIndices.push(w[0].boneId, w[1].boneId, w[2].boneId, w[3].boneId);
      skinWeights.push(w[0].weight, w[1].weight, w[2].weight, w[3].weight);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));

  // 构建骨骼
  const boneMap = new Map<number, THREE.Bone>();
  const boneArray: THREE.Bone[] = [];

  for (const b of smd.bones) {
    const bone = new THREE.Bone();
    bone.name = b.name;
    boneMap.set(b.id, bone);
    boneArray.push(bone);
  }

  // 设置父子关系
  let rootBone: THREE.Bone | undefined;
  for (const b of smd.bones) {
    const bone = boneMap.get(b.id)!;
    if (b.parentId >= 0) {
      const parent = boneMap.get(b.parentId);
      parent?.add(bone);
    } else {
      rootBone = bone;
    }
  }

  // 应用参考姿势 (frame 0)
  if (smd.frames.length > 0) {
    for (const kf of smd.frames[0].keyframes) {
      const bone = boneMap.get(kf.boneId);
      if (bone) {
        bone.position.copy(kf.position).multiplyScalar(scale);
        bone.rotation.copy(kf.rotation);
      }
    }
  }

  const skeleton = new THREE.Skeleton(boneArray);

  texture.flipY = false;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.1,
  });

  const mesh = new THREE.SkinnedMesh(geometry, material);
  if (rootBone) mesh.add(rootBone);
  mesh.bind(skeleton);

  return { mesh, skeleton };
}

/**
 * 从 SMD 动画数据构建 Three.js AnimationClip
 */
export function buildAnimationClip(
  name: string,
  smd: SMDData,
  bones: SMDBone[],
  scale: number,
  fps: number = 24,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const boneNames = new Map<number, string>();
  for (const b of bones) boneNames.set(b.id, b.name);

  // 按骨骼分组
  const boneKeyframes = new Map<number, { times: number[]; positions: number[]; rotations: number[] }>();

  for (const frame of smd.frames) {
    const time = frame.time / fps;
    for (const kf of frame.keyframes) {
      if (!boneKeyframes.has(kf.boneId)) {
        boneKeyframes.set(kf.boneId, { times: [], positions: [], rotations: [] });
      }
      const bk = boneKeyframes.get(kf.boneId)!;
      bk.times.push(time);
      bk.positions.push(kf.position.x * scale, kf.position.y * scale, kf.position.z * scale);

      const q = new THREE.Quaternion().setFromEuler(kf.rotation);
      bk.rotations.push(q.x, q.y, q.z, q.w);
    }
  }

  for (const [boneId, data] of boneKeyframes) {
    const boneName = boneNames.get(boneId);
    if (!boneName) continue;

    tracks.push(
      new THREE.VectorKeyframeTrack(
        `${boneName}.position`,
        data.times,
        data.positions,
      ),
    );
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${boneName}.quaternion`,
        data.times,
        data.rotations,
      ),
    );
  }

  return new THREE.AnimationClip(name, -1, tracks);
}
