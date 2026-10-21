"""验证 Full 私有凭据的有效 ACL；只允许当前用户和 SYSTEM，不降低权限检查。"""
import ctypes
import os

def require(value, code):
    if not value:
        raise PermissionError(code)

def verify_private_acl(path):
    if os.name != "nt":
        metadata = path.stat()
        require(metadata.st_uid == os.getuid() and metadata.st_mode & 0o077 == 0, "PRIVATE_CONFIG_ACL")
        return
    from ctypes import wintypes
    security, kernel = ctypes.WinDLL("advapi32", use_last_error=True), ctypes.WinDLL("kernel32", use_last_error=True)
    security.GetNamedSecurityInfoW.argtypes = [wintypes.LPWSTR, wintypes.DWORD, wintypes.DWORD,
        ctypes.c_void_p, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)]
    security.GetNamedSecurityInfoW.restype = wintypes.DWORD
    security.GetSecurityDescriptorControl.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.WORD), ctypes.POINTER(wintypes.DWORD)]
    security.GetAce.argtypes = [ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p)]
    security.ConvertSidToStringSidW.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.LPWSTR)]
    security.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    security.GetTokenInformation.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]

    def sid_text(pointer):
        text = wintypes.LPWSTR()
        require(security.ConvertSidToStringSidW(pointer, ctypes.byref(text)), "PRIVATE_CONFIG_ACL")
        try:
            return text.value
        finally:
            kernel.LocalFree(ctypes.cast(text, ctypes.c_void_p))

    token, size = wintypes.HANDLE(), wintypes.DWORD()
    require(security.OpenProcessToken(kernel.GetCurrentProcess(), 8, ctypes.byref(token)), "PRIVATE_CONFIG_ACL")
    try:
        security.GetTokenInformation(token, 1, None, 0, ctypes.byref(size))
        buffer = ctypes.create_string_buffer(size.value)
        require(security.GetTokenInformation(token, 1, buffer, size, ctypes.byref(size)), "PRIVATE_CONFIG_ACL")
        current_sid = sid_text(ctypes.c_void_p.from_buffer(buffer).value)
    finally:
        kernel.CloseHandle(token)
    dacl, descriptor = ctypes.c_void_p(), ctypes.c_void_p()
    require(security.GetNamedSecurityInfoW(str(path), 1, 4, None, None, ctypes.byref(dacl), None, ctypes.byref(descriptor)) == 0, "PRIVATE_CONFIG_ACL")
    try:
        control, revision = wintypes.WORD(), wintypes.DWORD()
        require(dacl.value and security.GetSecurityDescriptorControl(descriptor, ctypes.byref(control), ctypes.byref(revision)), "PRIVATE_CONFIG_ACL")
        # ACL header: revision, reserved, size, AceCount, reserved.
        count = ctypes.c_ushort.from_address(dacl.value + 4).value
        principals = set()
        for index in range(count):
            ace = ctypes.c_void_p()
            require(security.GetAce(dacl, index, ctypes.byref(ace)), "PRIVATE_CONFIG_ACL")
            # Inheritance is safe when the effective DACL still grants only these principals.
            require(ctypes.c_ubyte.from_address(ace.value).value == 0, "PRIVATE_CONFIG_ACL")
            principals.add(sid_text(ace.value + 8))
        require(principals == {current_sid, "S-1-5-18"}, "PRIVATE_CONFIG_ACL")
    finally:
        kernel.LocalFree(descriptor)

