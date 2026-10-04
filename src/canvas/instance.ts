import { InteractionController } from './controller';

let renderInteractive: () => void = () => {};

export const setInteractiveRenderer = (fn: () => void) => {
  renderInteractive = fn;
};

/** Single controller shared by the canvas, keyboard shortcuts and menus. */
export const controller = new InteractionController(() => renderInteractive());
