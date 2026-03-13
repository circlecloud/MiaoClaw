/**
 * PQC 配置文件解析器
 * 格式:
 *   $body bt.smd
 *   $anim walk walk.smd
 *   $anim idle idle.smd
 *   $scale 22.0
 */
export interface PQCConfig {
  body: string;
  anims: Record<string, string>;
  scale: number;
  texture?: string;
}

export function parsePQC(content: string): PQCConfig {
  const config: PQCConfig = { body: "", anims: {}, scale: 1.0 };

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;

    const parts = trimmed.split(/\s+/);
    switch (parts[0]) {
      case "$body":
        config.body = parts[1];
        break;
      case "$anim":
        config.anims[parts[1]] = parts[2];
        break;
      case "$scale":
        config.scale = parseFloat(parts[1]) || 1.0;
        break;
      case "$texture":
        config.texture = parts[1];
        break;
    }
  }

  return config;
}
