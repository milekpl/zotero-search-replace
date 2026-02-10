/**
 * Progress Dialog Controller for Zotero Search & Replace Plugin
 * Handles the progress dialog for batch operations
 */

var ProgressDialog = {
  canceled: false,

  init: function() {
    this.progressMeter = document.getElementById('progress-bar');
    this.statusLabel = document.getElementById('status-label');
    this.cancelButton = document.getElementById('cancel-button');

    if (this.cancelButton) {
      this.cancelButton.addEventListener('click', () => this.cancel());
    }

    // Listen for messages from the parent window
    window.addEventListener('message', (event) => {
      if (event.data.type === 'progress') {
        this.updateProgress(event.data.percent, event.data.status);
      }
    });
  },

  updateProgress: function(percent, status) {
    if (this.progressMeter) {
      this.progressMeter.value = percent;
    }
    if (this.statusLabel && status) {
      this.statusLabel.textContent = status;
    }
  },

  cancel: function() {
    this.canceled = true;
    if (window.opener && typeof window.opener.cancelProgress === 'function') {
      window.opener.cancelProgress();
    }
    window.close();
  }
};

document.addEventListener('DOMContentLoaded', function() {
  ProgressDialog.init();
});
