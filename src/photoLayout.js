export const PHOTO_LAYOUT_FALLBACK_GAP = 12;

export function getTargetRowHeight(containerWidth) {
  if (containerWidth <= 640) {
    return 150;
  }

  if (containerWidth <= 1023) {
    return 210;
  }

  return 260;
}

function getPhotoAspectRatio(photo) {
  const width = Number(photo?.width);
  const height = Number(photo?.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1;
  }

  return width / height;
}

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

function getRowAspectRatio(entries) {
  return entries.reduce((total, entry) => total + entry.aspectRatio, 0);
}

function getWidthAtHeight(entries, rowHeight, gap) {
  const contentWidth = entries.reduce((total, entry) => total + entry.aspectRatio * rowHeight, 0);
  return contentWidth + Math.max(entries.length - 1, 0) * gap;
}

function getJustifiedRowHeight(entries, containerWidth, gap) {
  const totalAspectRatio = getRowAspectRatio(entries);

  if (totalAspectRatio <= 0) {
    return 0;
  }

  const availableWidth = Math.max(containerWidth - Math.max(entries.length - 1, 0) * gap, 0);
  return availableWidth / totalAspectRatio;
}

function getRelaxedRowHeight(entries, containerWidth, gap, targetRowHeight) {
  if (containerWidth <= 0) {
    return targetRowHeight;
  }

  const fittedHeight = getJustifiedRowHeight(entries, containerWidth, gap);

  if (!Number.isFinite(fittedHeight) || fittedHeight <= 0) {
    return targetRowHeight;
  }

  return Math.min(targetRowHeight, fittedHeight);
}

function buildRow(entries, containerWidth, gap, targetRowHeight, isLastRow) {
  const rowHeight = isLastRow
    ? getRelaxedRowHeight(entries, containerWidth, gap, targetRowHeight)
    : getJustifiedRowHeight(entries, containerWidth, gap);

  return {
    isLastRow,
    items: entries.map((entry) => ({
      photo: entry.photo,
      originalIndex: entry.originalIndex,
      width: roundToTwoDecimals(entry.aspectRatio * rowHeight),
      height: roundToTwoDecimals(rowHeight),
    })),
  };
}

export function buildJustifiedRows(photos, containerWidth, gap = PHOTO_LAYOUT_FALLBACK_GAP, targetRowHeight) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return [];
  }

  const safeContainerWidth = Number.isFinite(containerWidth) ? Math.max(containerWidth, 0) : 0;
  const safeGap = Number.isFinite(gap) ? Math.max(gap, 0) : PHOTO_LAYOUT_FALLBACK_GAP;
  const safeTargetRowHeight =
    Number.isFinite(targetRowHeight) && targetRowHeight > 0
      ? targetRowHeight
      : getTargetRowHeight(safeContainerWidth);

  const preparedPhotos = photos.map((photo, originalIndex) => ({
    photo,
    originalIndex,
    aspectRatio: getPhotoAspectRatio(photo),
  }));

  if (safeContainerWidth <= 0) {
    return preparedPhotos.map((entry) => buildRow([entry], 0, safeGap, safeTargetRowHeight, true));
  }

  const rows = [];
  let pendingEntries = [];

  for (const entry of preparedPhotos) {
    const nextEntries = [...pendingEntries, entry];
    const nextEntriesWidthAtTarget = getWidthAtHeight(nextEntries, safeTargetRowHeight, safeGap);

    if (nextEntriesWidthAtTarget < safeContainerWidth) {
      pendingEntries = nextEntries;
      continue;
    }

    if (pendingEntries.length === 0) {
      rows.push(buildRow(nextEntries, safeContainerWidth, safeGap, safeTargetRowHeight, false));
      pendingEntries = [];
      continue;
    }

    const withCandidateHeight = getJustifiedRowHeight(nextEntries, safeContainerWidth, safeGap);
    const withoutCandidateHeight = getJustifiedRowHeight(pendingEntries, safeContainerWidth, safeGap);
    const shouldKeepCandidate =
      Math.abs(withCandidateHeight - safeTargetRowHeight) <=
      Math.abs(withoutCandidateHeight - safeTargetRowHeight);

    if (shouldKeepCandidate) {
      rows.push(buildRow(nextEntries, safeContainerWidth, safeGap, safeTargetRowHeight, false));
      pendingEntries = [];
      continue;
    }

    rows.push(buildRow(pendingEntries, safeContainerWidth, safeGap, safeTargetRowHeight, false));
    pendingEntries = [entry];
  }

  if (pendingEntries.length > 0) {
    rows.push(buildRow(pendingEntries, safeContainerWidth, safeGap, safeTargetRowHeight, true));
  }

  return rows;
}
