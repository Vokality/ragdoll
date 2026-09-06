/** Identity and document checks both matter: an iframe shares its parent's sender. */
export interface RendererAuthority {
  sender: object;
  mainFrame: { url: string };
  documentUrl: string;
}

export function isAuthorizedRenderer(
  event: { sender: object; senderFrame: { url: string } | null },
  authority: RendererAuthority | null,
): boolean {
  if (
    !authority ||
    event.sender !== authority.sender ||
    event.senderFrame !== authority.mainFrame
  )
    return false;
  try {
    const actual = new URL(event.senderFrame.url);
    const expected = new URL(authority.documentUrl);
    actual.hash = "";
    expected.hash = "";
    return actual.href === expected.href;
  } catch {
    return false;
  }
}
