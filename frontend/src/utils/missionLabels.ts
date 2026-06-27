/** Map mission id to i18n catalog key (hyphens → underscores). */
export function missionCatalogKey(missionId: string): string {
  return missionId.replace(/-/g, "_");
}
