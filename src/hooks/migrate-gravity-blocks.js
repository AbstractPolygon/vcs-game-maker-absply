'use strict';

// One-time migration of the Gravity block (object_gravity): its first number used to be the frames between speed-ups of a whole pixel (RATE), and is now the
// eighths of a pixel the fall speed grows by every frame (PULL, 1 to 16: the same as the gravity of the Platform block). A saved block keeps about the same fall:
// a number block of N frames (1, 2, 4, 8, 16 or 32, as it was taken down to) is 8 / N eighths a frame, at least 1; any other block (a variable) becomes 2.
// Raw workspace XML string in and out, like hooks/migrate-inertia-accelerate-blocks.js (called from main.js for a project in local storage and from Project.vue
// for an opened file).
export const migrateLegacyGravityBlocksInWorkspaceXml = (workspaceXml) => {
  if (!workspaceXml || !workspaceXml.includes('object_gravity')) return workspaceXml;
  try {
    const doc = new DOMParser().parseFromString(workspaceXml, 'text/xml');
    if (doc.querySelector('parsererror')) return workspaceXml;
    let changed = false;
    doc.querySelectorAll('block[type="object_gravity"]').forEach((block) => {
      const value = block.querySelector(':scope > value[name="RATE"]');
      if (!value) return;
      changed = true;
      value.setAttribute('name', 'PULL');
      const number = value.querySelector(':scope > shadow[type="math_number"] > field[name="NUM"], :scope > block[type="math_number"] > field[name="NUM"]');
      if (number) {
        const frames = 2 ** Math.floor(Math.log2(Math.max(1, Math.min(32, Number(number.textContent) || 1))));
        number.textContent = String(Math.max(1, Math.round(8 / frames)));
      } else {
        value.querySelectorAll(':scope > block, :scope > shadow').forEach((child) => value.removeChild(child));
        const shadow = doc.createElement('shadow');
        shadow.setAttribute('type', 'math_number');
        const field = doc.createElement('field');
        field.setAttribute('name', 'NUM');
        field.textContent = '2';
        shadow.appendChild(field);
        value.appendChild(shadow);
      }
    });
    if (!changed) return workspaceXml;
    return new XMLSerializer().serializeToString(doc);
  } catch (e) {
    console.error('Failed to migrate the Gravity blocks in the workspace', e);
    return workspaceXml;
  }
};

const WORKSPACE_KEY = 'vcs-game-maker.workspace';

export const migrateLegacyGravityBlocksInLocalStorage = () => {
  const workspaceXml = localStorage.getItem(WORKSPACE_KEY);
  if (!workspaceXml) return;
  const migrated = migrateLegacyGravityBlocksInWorkspaceXml(workspaceXml);
  if (migrated != null && migrated !== workspaceXml) {
    localStorage.setItem(WORKSPACE_KEY, migrated);
  }
};
