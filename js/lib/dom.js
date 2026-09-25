export function $(id) {
  const local = document.getElementById(id);
  if (local) return local;

  const tcmsFrame = document.getElementById("mmi-tcms");
  const tcmsDoc = tcmsFrame?.contentDocument;
  if (tcmsDoc) return tcmsDoc.getElementById(id);

  return null;
}
