import {
  folders, folderArtists, activeFolderId, isFoldersPanelVisible,
  createFolder, removeFolder, moveArtistToFolder,
  getUnsortedArtistIds, getFolderName, showToast, allItems,
  favorites, currentView, selectedArtistIds
} from '../store/styleStore';
import './FoldersPanel.css';

function FolderItem({ folder, isActive, onSelect, onDelete, thumbnail }) {
  return (
    <div
      class={`folder-item ${isActive ? 'active' : ''}`}
      data-folder-id={folder.id}
      onClick={() => onSelect(folder.id)}
    >
      <button class="folder-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(folder); }} title="Delete folder">×</button>
      {thumbnail && (
        <div class="folder-item-thumbnail-container">
          <img src={thumbnail} alt={folder.name} class="folder-item-thumbnail" loading="lazy" />
        </div>
      )}
      <span class="folder-name">{folder.name}</span>
      <span class="folder-count">{(folderArtists.value.get(folder.id) || []).length}</span>
    </div>
  );
}

export default function FoldersPanel() {
  const visible = isFoldersPanelVisible.value;
  const view = currentView.value;
  const afId = activeFolderId.value;

  if (!visible || view !== 'favorites' || window.innerWidth <= 992) return null;

  const unsortedIds = getUnsortedArtistIds();
  const unsortedCount = unsortedIds.length;

  const handleSelect = (id) => {
    activeFolderId.value = id;
  };

  const handleCreate = () => {
    const name = prompt('Enter new folder name:', 'New Folder');
    if (name) createFolder(name);
  };

  const handleDelete = (folder) => {
    const count = (folderArtists.value.get(folder.id) || []).length;
    const msg = count > 0
      ? `The folder "${folder.name}" contains ${count} card(s). Delete?`
      : `Delete folder "${folder.name}"?`;
    if (window.confirm(msg)) {
      removeFolder(folder.id);
      if (afId === folder.id) activeFolderId.value = 'unsorted';
      showToast(`Folder "${folder.name}" deleted.`);
    }
  };

  const getThumbnail = (folderId) => {
    if (folderId === 'unsorted') {
      if (unsortedIds.length > 0) {
        const item = allItems.value.find(i => i.id === unsortedIds[0]);
        return item?.image;
      }
      return null;
    }
    const entries = folderArtists.value.get(folderId) || [];
    if (entries.length > 0) {
      const lastId = entries.sort((a, b) => b.added - a.added)[0].id;
      const item = allItems.value.find(i => i.id === lastId);
      return item?.image;
    }
    return null;
  };

  return (
    <div class="folders-panel-wrapper">
      <div class="folders-panel">
        <div class="folders-header">Folders</div>
        <div class="folders-hint">
          <span>Drag a card to move it into a folder.</span>
        </div>
        <div class="folders-list-container">
          <div
            class={`folder-item folder-item--unsorted ${afId === 'unsorted' ? 'active' : ''}`}
            onClick={() => handleSelect('unsorted')}
          >
            {getThumbnail('unsorted') && (
              <div class="folder-item-thumbnail-container">
                <img src={getThumbnail('unsorted')} alt="Unsorted" class="folder-item-thumbnail" loading="lazy" />
              </div>
            )}
            <span class="folder-name">Unsorted</span>
            <span class="folder-count">{unsortedCount}</span>
          </div>

          {folders.value.map(f => (
            <FolderItem
              key={f.id}
              folder={f}
              isActive={afId === f.id}
              onSelect={handleSelect}
              onDelete={handleDelete}
              thumbnail={getThumbnail(f.id)}
            />
          ))}

          <button class="add-folder-button" onClick={handleCreate}>+ New Folder</button>
        </div>
      </div>
    </div>
  );
}
