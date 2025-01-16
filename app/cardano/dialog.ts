export const showReturningModal = (id: string): Promise<string> => {
  const dialog = document.getElementById(id) as HTMLFormElement;
  return new Promise<string>((resolve, reject) => {
    const listener = () => {
      dialog.removeEventListener("close", listener);
      if (dialog.returnValue) {
        resolve(dialog.returnValue);
      } else {
        reject(new Error("No value selected"));
      }
    };
    dialog.addEventListener("close", listener);
    dialog.showModal();
  });
};
