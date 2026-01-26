# 🚀 PPTypst Early Preview

Unfortunately, this Add-in is not yet available in the PowerPoint Add-in Marketplace. It will hopefully appear there mid-March. Until then, here is what you can do to still use the Add-in beforehand. See more detailed instructions [in the Office docs](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/create-a-network-shared-folder-catalog-for-task-pane-and-content-add-ins).

## Install

1. **Download** the [`manifest.prod.xml`](https://github.com/user-attachments/files/24866664/manifest.prod.xml) and place it in any folder, e.g. a new folder called `pptypst` in your Downloads.
2. **Share the folder** where you placed `manifest.prod.xml`.
    - Go to the folder properties (`Alt+Enter` on the folder) → Sharing → Share... → Choose your own user (probably already there) → Share
    - Note down the path being shown by right-clicking it → Copy Link.
    - The link should read something along the lines of `\\PC-Name\Users\username\Downloads\pptypst`.
3. **Sideload the Add-in into PowerPoint**.
    - PowerPoint → File → Options → Trust Center → Trust Center Settings → Trusted Add-in Catalogs.
    - As _Catalog Url_, enter the path you have copied (only the part after `file:` that starts with `\\` or `//`).
    - Then, click on "Add catalog" and check "Show in Menu". → Ok
    - Restart PowerPoint → "Home" ribbon → Add-ins → More Add-ins → Shared Folder → pick the PPTypst Add-in.
    - You should see the PPTypst Icon in the "Insert" ribbon (to the very right). Enjoy.

The installation will get a lot easier once the Add-in is available in the Marketplace. In this case, you'd just go the the "Home" ribbon, click on Add-ins, search for "PPTypst" and install it 😅

## Remove

If you want to get rid of the Add-in later on, manually delete the Office cache as described [in the docs](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/clear-cache#manually-clear-the-cache-in-excel-word-and-powerpoint). Essentially, you just have to delete the entire content of this folder (on Windows):

```sh
%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\
```

Manually removing the content of this folder worked fine for me, but please watch out that you don't have anything important there.
