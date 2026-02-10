/**
 * Progress Manager for Zotero Search & Replace Plugin
 * Handles progress dialog and batch operation feedback
 */

class ProgressManager {
  constructor(window) {
    this.window = window;
    this.dialog = null;
    this.progressMeter = null;
    this.statusLabel = null;
    this.canceled = false;
  }

  // Open progress dialog
  open(title, totalItems) {
    this.canceled = false;
    this.dialog = this.window.openDialog(
      'chrome://zotero-search-replace/content/progress.xul',
      'progress',
      'modal,titlebar,centerscreen',
      { title, total: totalItems }
    );
    return this.dialog;
  }

  // Open HTML progress dialog (for Zotero 7+)
  openHTML(title, totalItems) {
    this.canceled = false;
    this.dialog = this.window.openDialog(
      'chrome://zotero-search-replace/content/progress.html',
      'progress',
      'modal,titlebar,centerscreen,width=400,height=200',
      { title, total: totalItems }
    );
    return this.dialog;
  }

  // Update progress
  update(current, status) {
    if (!this.dialog || this.canceled) return false;

    try {
      if (this.progressMeter) {
        const percent = Math.round((current / this.dialog.arguments.total) * 100);
        this.progressMeter.value = percent;
      }
      if (this.statusLabel && status) {
        this.statusLabel.value = status;
      }

      // Process events to keep UI responsive
      if (this.window.setTimeout) {
        this.window.setTimeout(() => { }, 0);
      }
    } catch (e) {
      // Dialog might be closed
      return false;
    }

    return !this.canceled;
  }

  // Update from HTML dialog via postMessage
  updateFromMessage(data) {
    if (!this.dialog || this.canceled) return false;

    try {
      if (data.type === 'progress' && this.progressMeter) {
        this.progressMeter.value = data.percent;
      }
      if (data.type === 'progress' && this.statusLabel && data.status) {
        this.statusLabel.value = data.status;
      }
      if (data.type === 'complete') {
        this.canceled = true;
      }
    } catch (e) {
      return false;
    }

    return !this.canceled;
  }

  // Close dialog
  close() {
    if (this.dialog) {
      try {
        this.dialog.close();
      } catch (e) {
        // Might already be closed
      }
      this.dialog = null;
    }
  }

  // Cancel operation
  cancel() {
    this.canceled = true;
  }
}

export default ProgressManager;
