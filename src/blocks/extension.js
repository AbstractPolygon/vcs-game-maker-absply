import * as Blockly from 'blockly/core';

// The number inputs of a block start with a number (a shadow block, which shows even when a saved project has no block there): the default of each input.
export const numberDefaultsExtension = (defaults) => function() {
  // eslint-disable-next-line no-invalid-this
  const block = this;
  Object.entries(defaults).forEach(([name, value]) => {
    const input = block.getInput(name);
    if (input && input.connection) input.connection.setShadowState({type: 'math_number', fields: {NUM: value}});
  });
};

// Registers a block extension, replacing one of the same name. The page's hot reload runs a block file again after an edit, and registering a name that
// is already registered throws: the rest of the file was then not run again, and the blocks after it kept their old definitions (a block coming out
// malformed, until the page was refreshed).
export const registerExtension = (name, init) => {
  try {
    Blockly.Extensions.register(name, init);
  } catch (e) {
    Blockly.Extensions.unregister(name);
    Blockly.Extensions.register(name, init);
  }
};
