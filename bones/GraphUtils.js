function findNodeByName(root, name) {
  let found = null;
  root.traverse((child) => {
    if (found !== null) return;
    else if (child.name == name) found = child;
  });
  return found;
}

export { findNodeByName };
