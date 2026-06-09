export function normalizePrintTablePagination(doc) {
  if (!doc || !doc.querySelectorAll) return

  const tableSelector = 'table.hiprint-printElement-tableTarget'
  // Keep a small printable safety zone at the bottom of each paper. Browser
  // print preview may recalculate page content with a slightly smaller
  // printable area than the screen DOM, so rows placed flush to the paper edge
  // can be clipped and appear as "missing" at page boundaries.
  const bottomSafetyGap = 18
  const maxPasses = 20

  const getPapers = () => Array.from(doc.querySelectorAll('.hiprint-printPaper'))

  const cloneContinuationPaper = (paper) => {
    const clone = paper.cloneNode(true)
    clone.querySelectorAll(`${tableSelector} tbody`).forEach((tbody) => {
      tbody.innerHTML = ''
    })
    paper.parentNode.insertBefore(clone, paper.nextSibling)
    return clone
  }

  for (let pass = 0; pass < maxPasses; pass++) {
    let movedAnyRow = false
    const papers = getPapers()

    for (let paperIndex = 0; paperIndex < papers.length; paperIndex++) {
      const paper = papers[paperIndex]
      const paperBottom = paper.getBoundingClientRect().bottom - bottomSafetyGap
      const tables = Array.from(paper.querySelectorAll(tableSelector))

      for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
        const table = tables[tableIndex]
        const tbody = table.tBodies && table.tBodies[0]
        if (!tbody) continue

        let rows = Array.from(tbody.rows)
        while (rows.length > 0) {
          const lastRow = rows[rows.length - 1]
          const rowRect = lastRow.getBoundingClientRect()
          if (rowRect.height <= 0 || rowRect.bottom <= paperBottom) break

          let nextPaper = getPapers()[paperIndex + 1]
          if (!nextPaper) {
            nextPaper = cloneContinuationPaper(paper)
          }

          const nextTable = Array.from(nextPaper.querySelectorAll(tableSelector))[tableIndex]
          const nextTbody = nextTable && nextTable.tBodies && nextTable.tBodies[0]
          if (!nextTbody) break

          nextTbody.insertBefore(lastRow, nextTbody.firstElementChild)
          rows.pop()
          movedAnyRow = true
        }
      }
    }

    if (!movedAnyRow) break
  }
}
