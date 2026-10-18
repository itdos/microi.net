// 只记录官方 MCP 上传且公共 CDN 原始字节验签通过的课件；历史 PPTX 和旧别名保留兼容。
export const trainingDownloads = Object.freeze([
  {
    "legacyPath": "/downloads/microi-ai-development-framework-training-syllabus-dark.pdf",
    "url": "https://file.microi.net/itdos/official-docs/downloads/93ff0fdfa2444f0c9c92a3b271a50dd34ebb73bc374de186a4f69636117891dd/202610/microi-ai-development-framework-training-syllabus-dark.pdf",
    "bytes": 21682594,
    "sha256": "93ff0fdfa2444f0c9c92a3b271a50dd34ebb73bc374de186a4f69636117891dd",
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
    "url": "https://file.microi.net/itdos/official-docs/downloads/3ecb71a6c1e11bee8490754bad163163c230ea7270309832a5febdf3ec75404e/202610/microi-ai-development-framework-training-syllabus-light.pdf",
    "bytes": 22550215,
    "sha256": "3ecb71a6c1e11bee8490754bad163163c230ea7270309832a5febdf3ec75404e",
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
    "url": "https://file.microi.net/itdos/official-docs/downloads/3c581b3373df4daf14a23eee3031e74c8b404ddda5a18a92a5ad20a246ad82e2/202610/microi-enterprise-application-training-syllabus-dark.pdf",
    "bytes": 5571852,
    "sha256": "3c581b3373df4daf14a23eee3031e74c8b404ddda5a18a92a5ad20a246ad82e2",
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
    "url": "https://file.microi.net/itdos/official-docs/downloads/5f20ea360e76cd81a174881dad88a14b2a0112a991a2fdb104cdad0272b1da10/202610/microi-enterprise-application-training-syllabus-light.pdf",
    "bytes": 5798314,
    "sha256": "5f20ea360e76cd81a174881dad88a14b2a0112a991a2fdb104cdad0272b1da10",
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
