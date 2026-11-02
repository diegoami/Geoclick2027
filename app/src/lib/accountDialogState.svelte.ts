let open = $state(false);
export const accountOpen = () => open;
export function setAccountOpen(value: boolean): void {
	open = value;
}
