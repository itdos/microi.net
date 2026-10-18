// 只记录官方 MCP 上传且公共 CDN 原始字节验签通过的课件；历史 PPTX 和旧别名保留兼容。
export const trainingDownloads = Object.freeze([
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-dark.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/7a48f41656d9defdb22bcde2a4a90d601df7ad1c86c75ad13f9de7169e64bb02/202610/microi-ai-development-framework-training-syllabus-dark.pdf",
    "bytes": 21939339,
    "sha256": "7a48f41656d9defdb22bcde2a4a90d601df7ad1c86c75ad13f9de7169e64bb02",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-dark.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/91fca7e19146f0be7feedc24e92f8561923d30ae4abb6e77c33eb10acf1fbca3/202610/microi-ai-development-framework-training-syllabus-dark.pptx",
    "bytes": 11840409,
    "sha256": "91fca7e19146f0be7feedc24e92f8561923d30ae4abb6e77c33eb10acf1fbca3",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-light.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/031d1a1dc4215a4733fe42e0206ba7979f46f00e84e705e2e488a7468d55bd1f/202610/microi-ai-development-framework-training-syllabus-light.pdf",
    "bytes": 22805965,
    "sha256": "031d1a1dc4215a4733fe42e0206ba7979f46f00e84e705e2e488a7468d55bd1f",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-light.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/1d56cbe0a01c0ff61fd12a018e3f763634250a61cd9561ca672c8b6318786ff0/202610/microi-ai-development-framework-training-syllabus-light.pptx",
    "bytes": 11900949,
    "sha256": "1d56cbe0a01c0ff61fd12a018e3f763634250a61cd9561ca672c8b6318786ff0",
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
    "url": "https://file.microi.net/itdos/official-docs/downloads/325aebd849fc5d7401eedfabbf6f30e9a93eac71e8294dd0b74b9a5c805f4bcf/202610/microi-enterprise-application-training-syllabus-dark.pdf",
    "bytes": 5827126,
    "sha256": "325aebd849fc5d7401eedfabbf6f30e9a93eac71e8294dd0b74b9a5c805f4bcf",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-dark.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/b5032ea7310acced4958f2def73aa76f35c4fc879d72aeef6df688e1c4f41009/202610/microi-enterprise-application-training-syllabus-dark.pptx",
    "bytes": 7592513,
    "sha256": "b5032ea7310acced4958f2def73aa76f35c4fc879d72aeef6df688e1c4f41009",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-light.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/63c8a4e098732add3b5b5f114c710ef7695ac708dfc98be1db6c4691d9ff2bf0/202610/microi-enterprise-application-training-syllabus-light.pdf",
    "bytes": 6054428,
    "sha256": "63c8a4e098732add3b5b5f114c710ef7695ac708dfc98be1db6c4691d9ff2bf0",
    "mimeType": "application/pdf"
  },
  {
    "legacyPath": "/downloads/microi-enterprise-application-training-syllabus-light.pptx",
    "url": "https://file.microi.net/itdos/official-docs/downloads/287a12d688496c9de17e2430847d5ba99c3c2d6a4908edc6ac9a08f04e3e4ad2/202610/microi-enterprise-application-training-syllabus-light.pptx",
    "bytes": 7593780,
    "sha256": "287a12d688496c9de17e2430847d5ba99c3c2d6a4908edc6ac9a08f04e3e4ad2",
    "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
].map(asset => Object.freeze(asset)))
