// 只记录官方 MCP 上传且公共 CDN 原始字节验签通过的课件；历史 PPTX 和旧别名保留兼容。
export const trainingDownloads = Object.freeze([
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-dark.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/335b2937b5bcf21e6cd71c2f8ac03fc8a1401926c02cdeb05b0a3a96fe0ecf57/202610/microi-ai-development-framework-training-syllabus-dark.pdf",
    "bytes": 21977479,
    "sha256": "335b2937b5bcf21e6cd71c2f8ac03fc8a1401926c02cdeb05b0a3a96fe0ecf57",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-dark.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/99271bbea9006d78b0f0654ea88630789d7e536d0b13776e3c67445f4532c7f0/202610/microi-ai-development-framework-training-syllabus-dark.pptx",
    "bytes": 9884014,
    "sha256": "99271bbea9006d78b0f0654ea88630789d7e536d0b13776e3c67445f4532c7f0",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-light.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/c9b2324413307a00c6fbc64582284b2a26bd846929236931a9473516834438f7/202610/microi-ai-development-framework-training-syllabus-light.pdf",
    "bytes": 22844473,
    "sha256": "c9b2324413307a00c6fbc64582284b2a26bd846929236931a9473516834438f7",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-light.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/f44e95319d5ee75702f57aa34ef0ad68c1332d04190160138ce10bd5a0abcf7a/202610/microi-ai-development-framework-training-syllabus-light.pptx",
    "bytes": 9822287,
    "sha256": "f44e95319d5ee75702f57aa34ef0ad68c1332d04190160138ce10bd5a0abcf7a",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/494b6a08a086c41dcf03cf86ee7390459d17981fbfebe45f4c4bf960b07355e5/202610/microi-ai-development-framework-training-syllabus.pdf",
    "bytes": 377239,
    "sha256": "494b6a08a086c41dcf03cf86ee7390459d17981fbfebe45f4c4bf960b07355e5",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-dark.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/cbbfc55b2f55e5c85e3478a4ff1c53ede0ec1daf07a86f0c063c71f286ca94e5/202610/microi-enterprise-application-training-syllabus-dark.pdf",
    "bytes": 5867903,
    "sha256": "cbbfc55b2f55e5c85e3478a4ff1c53ede0ec1daf07a86f0c063c71f286ca94e5",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-dark.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/69fa8d983f3d96c965faf4057736d3e1a8f4b40e21f99bd1c0582d104ff7808b/202610/microi-enterprise-application-training-syllabus-dark.pptx",
    "bytes": 3714058,
    "sha256": "69fa8d983f3d96c965faf4057736d3e1a8f4b40e21f99bd1c0582d104ff7808b",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-light.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/9acabbb68bd7f00ac31a9a3ae1caf16af1498c24a1966862bbd0e85666383d4b/202610/microi-enterprise-application-training-syllabus-light.pdf",
    "bytes": 6095756,
    "sha256": "9acabbb68bd7f00ac31a9a3ae1caf16af1498c24a1966862bbd0e85666383d4b",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-light.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/ffed1f8f7a55ee1dfba95a72592778c25ea9c9afdaba44bfb3c0274199d19ccc/202610/microi-enterprise-application-training-syllabus-light.pptx",
    "bytes": 3936339,
    "sha256": "ffed1f8f7a55ee1dfba95a72592778c25ea9c9afdaba44bfb3c0274199d19ccc",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
].map(asset => Object.freeze(asset)))
