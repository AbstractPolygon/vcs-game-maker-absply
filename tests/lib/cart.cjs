// A cartridge for 6502.ts from ROM bytes: a PXE ROM (an ARM ELF file) is run by the app's CartridgePXE (tools/stellerator/pxe), the others
// by 6502.ts's cartridge factory.
const P = require('./paths.cjs');
const CF = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
const CartridgePXE = require(P.REPO + 'tools/stellerator/pxe/CartridgePXE');
module.exports = async (rom, tvSpec = 'NTSC') => (CartridgePXE.matchesBuffer(rom) ? new CartridgePXE(rom, {tvSpec}) : new CF().createCartridge(rom));
