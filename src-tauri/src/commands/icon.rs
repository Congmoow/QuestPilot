use crate::error::AppError;

#[cfg(target_os = "windows")]
mod win {
    use std::os::windows::ffi::OsStrExt;
    use std::ffi::OsStr;
    use std::ptr;

    use winapi::shared::windef::HGDIOBJ;
    use winapi::um::shellapi::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use winapi::um::wingdi::{
        BI_RGB, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS,
        CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, SelectObject,
    };
    use winapi::um::winuser::{DestroyIcon, DrawIconEx};
    const DI_NORMAL: u32 = 0x0003;

    pub fn extract_icon_base64(file_path: &str) -> Result<String, String> {
        let wide: Vec<u16> = OsStr::new(file_path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut shfi: SHFILEINFOW = unsafe { std::mem::zeroed() };
        let ret = unsafe {
            SHGetFileInfoW(
                wide.as_ptr(),
                0,
                &mut shfi,
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON | SHGFI_LARGEICON,
            )
        };
        if ret == 0 || shfi.hIcon.is_null() {
            return Err("SHGetFileInfoW failed".to_string());
        }
        let hicon = shfi.hIcon;
        let size: i32 = 32;

        let dc = unsafe { CreateCompatibleDC(ptr::null_mut()) };
        if dc.is_null() {
            unsafe { DestroyIcon(hicon); }
            return Err("CreateCompatibleDC failed".to_string());
        }

        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: size,
                biHeight: -size,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [unsafe { std::mem::zeroed() }],
        };

        let mut bits_ptr: *mut winapi::ctypes::c_void = ptr::null_mut();
        let hbm = unsafe {
            CreateDIBSection(dc, &bmi, DIB_RGB_COLORS, &mut bits_ptr, ptr::null_mut(), 0)
        };
        if hbm.is_null() {
            unsafe { DeleteDC(dc); DestroyIcon(hicon); }
            return Err("CreateDIBSection failed".to_string());
        }

        let prev = unsafe { SelectObject(dc, hbm as HGDIOBJ) };
        let drew = unsafe { DrawIconEx(dc, 0, 0, hicon, size, size, 0, ptr::null_mut(), DI_NORMAL) };

        let result = if drew != 0 {
            let n = (size * size * 4) as usize;
            let raw = unsafe { std::slice::from_raw_parts(bits_ptr as *const u8, n) };
            let mut rgba: Vec<u8> = raw.to_vec();
            for px in rgba.chunks_exact_mut(4) {
                px.swap(0, 2); // BGRA → RGBA
            }
            encode_png_base64(&rgba, size as u32)
        } else {
            Err("DrawIconEx failed".to_string())
        };

        unsafe {
            SelectObject(dc, prev);
            DeleteObject(hbm as HGDIOBJ);
            DeleteDC(dc);
            DestroyIcon(hicon);
        }
        result
    }

    fn encode_png_base64(rgba: &[u8], size: u32) -> Result<String, String> {
        let mut buf = Vec::<u8>::new();
        {
            let ref mut out = buf;
            let mut enc = png::Encoder::new(out, size, size);
            enc.set_color(png::ColorType::Rgba);
            enc.set_depth(png::BitDepth::Eight);
            let mut writer = enc.write_header().map_err(|e| e.to_string())?;
            writer.write_image_data(rgba).map_err(|e| e.to_string())?;
        }
        use base64::Engine;
        Ok(base64::engine::general_purpose::STANDARD.encode(&buf))
    }
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(err)]
pub fn get_file_icon(file_path: String) -> Result<String, AppError> {
    #[cfg(target_os = "windows")]
    {
        win::extract_icon_base64(&file_path)
            .map_err(|e| AppError::Config(format!("提取文件图标失败: {e}")))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        Err(AppError::Config("当前平台不支持提取系统图标".into()))
    }
}
