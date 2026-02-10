/**
 * Zotero Search & Replace Integration
 * Adds menu item to Tools menu and handles window events
 */

(function() {
  // Wait for Zotero to be ready
  if (typeof Zotero === 'undefined') {
    return;
  }

  // Add menu item when Zotero window is ready
  Zotero.addCallback('onOpen', function() {
    addMenuItem();
  });

  function addMenuItem() {
    try {
      // Get the tools menu
      const document = Zotero.getMainWindow().document;
      const toolsMenu = document.getElementById('menu_Tools');

      if (!toolsMenu) {
        // Try alternative menu
        const menuBar = document.getElementById('main-menubar');
        if (menuBar) {
          // Look for Tools menu by index (usually 5)
          const menus = menuBar.querySelectorAll('menu');
          for (const menu of menus) {
            if (menu.getAttribute('label') === 'Tools') {
              addMenuItemToMenu(menu, document);
              break;
            }
          }
        }
        return;
      }

      addMenuItemToMenu(toolsMenu, document);
    } catch (e) {
      Zotero.debug('Search & Replace: Error adding menu item: ' + e.message);
    }
  }

  function addMenuItemToMenu(menu, document) {
    // Check if menu item already exists
    const existingItem = document.getElementById('zotero-search-replace-menu-item');
    if (existingItem) {
      return;
    }

    // Create menu separator first
    const separator = document.createElement('menuseparator');
    separator.id = 'zotero-search-replace-separator';

    // Create menu item
    const menuItem = document.createElement('menuitem');
    menuItem.id = 'zotero-search-replace-menu-item';
    menuItem.setAttribute('label', 'Search & Replace...');
    menuItem.setAttribute('accesskey', 'S');
    menuItem.setAttribute('key', '');

    // Add click handler
    menuItem.addEventListener('command', function() {
      openSearchDialog();
    });

    // Insert separator and menu item before the last item
    if (menu.lastChild) {
      menu.insertBefore(separator, menu.lastChild);
      menu.insertBefore(menuItem, menu.lastChild);
    } else {
      menu.appendChild(separator);
      menu.appendChild(menuItem);
    }

    Zotero.debug('Search & Replace: Menu item added');
  }

  function openSearchDialog() {
    try {
      const window = Zotero.getMainWindow();
      if (window) {
        window.openDialog(
          'chrome://zotero-search-replace/content/dialog.html',
          'zotero-search-replace-dialog',
          'modal,chrome,centerscreen,width=800,height=600'
        );
      }
    } catch (e) {
      Zotero.debug('Search & Replace: Error opening dialog: ' + e.message);
    }
  }

  // Also expose open function globally for bootstrap.js integration
  if (typeof window !== 'undefined') {
    window.ZoteroSearchReplace = window.ZoteroSearchReplace || {};
    window.ZoteroSearchReplace.openDialog = openSearchDialog;
  }
})();
