/**
 * Minimal launcher for the live HTML dialog.
 * All in-dialog behavior is handled by content/scripts/dialog-controller.js.
 */

class SearchDialog {
  static open() {
    const mainWindow = Services.wm.getMostRecentWindow('navigator:browser');
    const dialogArgs = {
      patterns: mainWindow.ZoteroSearchReplace?.DATA_QUALITY_PATTERNS || []
    };

    return mainWindow.openDialog(
      'chrome://zotero-search-replace/content/dialog.html',
      'zotero-search-replace-dialog',
      'chrome,centerscreen,resizable=yes,width=800,height=600',
      dialogArgs
    );
  }
}

export default SearchDialog;
