// Lazy loader for pdfmake fonts: load only when needed and allow future custom minimal vfs.
let _fontsPromise = null
export async function loadPdfFonts(pdfMake) {
  if (_fontsPromise) return _fontsPromise
  _fontsPromise = (async () => {
    const { default: pdfFonts } = await import('pdfmake/build/vfs_fonts')
    pdfMake.vfs = pdfFonts.pdfMake.vfs
    return pdfMake
  })()
  return _fontsPromise
}
