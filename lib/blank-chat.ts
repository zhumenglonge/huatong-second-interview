export type MainView = 'conv' | 'canvas' | 'overview';

export function startBlankChat(
  resetTaskSelection: () => void,
  setView: (view: MainView) => void,
) {
  resetTaskSelection();
  setView('conv');
}
