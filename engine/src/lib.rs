use wasm_bindgen::prelude::*;
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, Source};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};

// A virtual world for Typst to live in
struct WasWorld {
    library: LazyHash<Library>,
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
    source: Source,
    now: Datetime,
}

impl World for WasWorld {
    fn library(&self) -> &LazyHash<Library> { &self.library }
    fn book(&self) -> &LazyHash<FontBook> { &self.book }
    fn main(&self) -> FileId { self.source.id() }
    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.source.id() { Ok(self.source.clone()) } 
        else { Err(FileError::NotFound("unknown".into())) }
    }
    fn file(&self, _id: FileId) -> FileResult<Bytes> { Err(FileError::NotFound("unknown".into())) }
    fn font(&self, index: usize) -> Option<Font> { self.fonts.get(index).cloned() }
    fn today(&self, _offset: Option<i64>) -> Option<Datetime> { Some(self.now) }
}

// Global state to hold fonts after initialization
static mut FONT_BUFFER: Vec<u8> = Vec::new();

#[wasm_bindgen]
pub fn init_fonts(font_data: &[u8]) {
    unsafe {
        FONT_BUFFER = font_data.to_vec();
    }
}

#[wasm_bindgen]
#[allow(static_mut_refs)]
pub fn compile_typst(text: &str) -> String {
    // 1. Load Font
    let font_data = unsafe { Bytes::new(FONT_BUFFER.clone()) };
    let font = Font::new(font_data, 0).expect("Could not parse font");
    let mut book = FontBook::new();
    book.push(font.info().clone());
    let book = LazyHash::new(book);
    
    // 2. Create World
    let library = LazyHash::new(Library::default());
    // Wrap the user content to remove page background/margins and let size shrink to content.
    let wrapped = format!(
        r#"
#set page(
  margin: 0pt,
  background: none,
  width: auto,
  fill: none,
  height: auto,
)
{body}
"#,
        body = text
    );

    let source = Source::detached(&wrapped);
    let world = WasWorld {
        library,
        book,
        fonts: vec![font],
        source,
        now: Datetime::from_ymd_hms(2023, 10, 1, 0, 0, 0).unwrap(),
    };

    // 3. Compile to a paged document (Typst 0.14.x supports PagedDocument for svg)
    match typst::compile::<typst::layout::PagedDocument>(&world).output {
        Ok(document) => typst_svg::svg(&document.pages[0]),
        Err(errors) => format!("Error: {}", errors[0].message),
    }
}
