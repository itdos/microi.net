// 只记录官方 MCP 上传且公共 CDN 原始字节验签通过的课件；历史 PPTX 和旧别名保留兼容。
export const trainingDownloads = Object.freeze([
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-dark.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/6b92bd370be3c549ad6cf62506b330360bcd05746021ca330de72dc9f20ca94a/202610/microi-ai-development-framework-training-syllabus-dark.pdf",
    "bytes": 21938761,
    "sha256": "6b92bd370be3c549ad6cf62506b330360bcd05746021ca330de72dc9f20ca94a",
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
    "url": "https://file.microi.net/itdos/official-docs/downloads/512cd2eb8ac7e2e0e142b35f8ce34d2325ff80369b487021c41d6bf742c44cb7/202610/microi-ai-development-framework-training-syllabus-light.pdf",
    "bytes": 22804823,
    "sha256": "512cd2eb8ac7e2e0e142b35f8ce34d2325ff80369b487021c41d6bf742c44cb7",
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
    "url": "https://file.microi.net/itdos/official-docs/downloads/0d2c0da1d95179011c6368cf73fa6d3deb0db9e12854628e6156ac2df3be539a/202610/microi-enterprise-application-training-syllabus-dark.pdf",
    "bytes": 5828720,
    "sha256": "0d2c0da1d95179011c6368cf73fa6d3deb0db9e12854628e6156ac2df3be539a",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-dark.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/0b430c3197055a0974a93f0fa3578ac04042c30af34c748e0285e798270ae437/202610/microi-enterprise-application-training-syllabus-dark.pptx",
    "bytes": 3700052,
    "sha256": "0b430c3197055a0974a93f0fa3578ac04042c30af34c748e0285e798270ae437",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-light.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/04af7c75efbc2d4faf0a996f61d41327ba214558a815b365fa9296a063c8f949/202610/microi-enterprise-application-training-syllabus-light.pdf",
    "bytes": 6055870,
    "sha256": "04af7c75efbc2d4faf0a996f61d41327ba214558a815b365fa9296a063c8f949",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-light.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/eb56237de9996250c3d03cd8416e621f494def2c9f1c286cab5e4c967a9aaed1/202610/microi-enterprise-application-training-syllabus-light.pptx",
    "bytes": 3915912,
    "sha256": "eb56237de9996250c3d03cd8416e621f494def2c9f1c286cab5e4c967a9aaed1",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
].map(asset => Object.freeze(asset)))
