// --- Global Variables and Setup ---
let canvas = document.getElementById("editorCanvas");
let ctx = canvas.getContext("2d");
let originalImg = null;
let initialImageData = null;
let keepRatioCheckbox = document.getElementById("keepRatio");
let canvasSection = document.getElementById("canvas-section");
let replaceEnabledCheckbox = document.getElementById("replaceEnabled");
let newBgColorPicker = document.getElementById("newBgColorPicker");

// History for undo/redo
let history = [];
let historyIndex = -1;
const MAX_HISTORY_STEPS = 20;

// Get undo/redo buttons
const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");
const fileInput = document.getElementById("fileInput");

// Crop functionality elements
const cropOverlay = document.getElementById("crop-overlay");
const cropBox = document.getElementById("crop-box");
const cropXInput = document.getElementById("cropX");
const cropYInput = document.getElementById("cropY");
const cropWidthInput = document.getElementById("cropWidth");
const cropHeightInput = document.getElementById("cropHeight");
let isCropping = false;
let isDragging = false;
let isResizing = false;
let dragStartX, dragStartY;
let resizeHandle = null;

window.onload = function () {
  // Set a default size and message for an empty canvas
  setInitialCanvasState();

  window.addEventListener("resize", () => {
    if (!originalImg) {
      setInitialCanvasState();
    }
    if (isCropping) {
      updateCropOverlayPosition();
    }
  });

  // Event listener for the "Replace with New Color" checkbox
  replaceEnabledCheckbox.addEventListener("change", function () {
    newBgColorPicker.disabled = !this.checked;
  });

  fileInput.addEventListener("change", handleFile);
  canvas.addEventListener("click", handleCanvasClick);
};

// --- History Functions ---
function saveHistory() {
  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  history.push(imageData);
  if (history.length > MAX_HISTORY_STEPS) {
    history.shift();
  } else {
    historyIndex++;
  }
  updateUndoRedoButtons();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    const imageData = history[historyIndex];
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    updateUndoRedoButtons();
    showMessage("Undo successful.");
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    const imageData = history[historyIndex];
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    updateUndoRedoButtons();
    showMessage("Redo successful.");
  }
}

function updateUndoRedoButtons() {
  undoButton.disabled = historyIndex <= 0;
  redoButton.disabled = historyIndex >= history.length - 1;
}

// --- UI/UX Functions ---
function setInitialCanvasState() {
  const containerWidth = canvasSection.offsetWidth;
  canvas.width = Math.min(800, containerWidth - 40);
  canvas.height = Math.min(600, containerWidth * 0.75);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#666";
  ctx.font = "24px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Drop an image here or use the Upload button",
    canvas.width / 2,
    canvas.height / 2,
  );
}

function showMessage(message, duration = 3000) {
  const msgBox = document.getElementById("messageBox");
  msgBox.textContent = message;
  msgBox.style.display = "block";
  setTimeout(() => {
    msgBox.style.display = "none";
  }, duration);
}

function showPanel(id) {
  if (isCropping) {
    cancelCrop();
  }
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  document
    .querySelectorAll("#sidebar-toolbar button")
    .forEach((btn) => btn.classList.remove("active"));
  const activeBtn = document.querySelector(
    `#sidebar-toolbar button[onclick="showPanel('${id}')"]`,
  );
  if (activeBtn) activeBtn.classList.add("active");

  if (id === "cropPanel" && originalImg) {
    startCrop();
  }
}

function showLoader(show = true, message = "Processing...") {
  const loader = document.getElementById("loader");
  loader.querySelector("p").textContent = message;
  loader.style.display = show ? "flex" : "none";
}

function setCheckerboard(enabled) {
  if (enabled) {
    canvasSection.classList.add("checkerboard");
  } else {
    canvasSection.classList.remove("checkerboard");
  }
}

// --- Image Loading and Resizing ---
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  processImageFile(file);
}

function handleDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    processImageFile(file);
  } else {
    showMessage("Please drop a valid image file.");
  }
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function processImageFile(file) {
  showLoader(true);
  const img = new Image();
  const reader = new FileReader();
  reader.onload = function (event) {
    img.onload = function () {
      // Set checkerboard based on image type (for transparency)
      if (file.type === "image/png" || file.type === "image/webp") {
        setCheckerboard(true);
      } else {
        setCheckerboard(false);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      originalImg = img;

      // Reset history and save initial state
      history = [];
      historyIndex = -1;
      saveHistory();

      initialImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Enable controls
      document.getElementById("resizeWidth").disabled = false;
      document.getElementById("resizeHeight").disabled = false;
      document.getElementById("keepRatio").disabled = false;
      document.getElementById("resizeButton").disabled = false;
      document.getElementById("resizeWidth").value = img.width;
      document.getElementById("resizeHeight").value = img.height;

      showLoader(false);
      showMessage("Image loaded successfully!");
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function applyResize() {
  if (!originalImg) {
    showMessage("Please upload an image first.");
    return;
  }
  showLoader(true);
  let width = parseInt(document.getElementById("resizeWidth").value);
  let height = parseInt(
    parseInt(document.getElementById("resizeHeight").value),
  );
  if (!width || width <= 0 || !height || height <= 0) {
    showMessage(
      "Invalid dimensions. Please enter valid width and height values.",
    );
    showLoader(false);
    return;
  }
  let temp = document.createElement("canvas");
  temp.width = width;
  temp.height = height;
  temp.getContext("2d").drawImage(canvas, 0, 0, width, height);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(temp, 0, 0);
  saveHistory();
  showLoader(false);
  showMessage("Image resized successfully!");
}

document.getElementById("resizeWidth").addEventListener("input", function () {
  if (keepRatioCheckbox.checked && originalImg) {
    let width = parseInt(this.value);
    let ratio = originalImg.width / originalImg.height;
    document.getElementById("resizeHeight").value = Math.round(width / ratio);
  }
});

document.getElementById("resizeHeight").addEventListener("input", function () {
  if (keepRatioCheckbox.checked && originalImg) {
    let height = parseInt(this.value);
    let ratio = originalImg.width / originalImg.height;
    document.getElementById("resizeWidth").value = Math.round(height * ratio);
  }
});

// --- Crop Functionality ---
function updateCropOverlayPosition() {
  const canvasRect = canvas.getBoundingClientRect();
  const parentRect = canvasSection.getBoundingClientRect();
  cropOverlay.style.left = `${canvasRect.left - parentRect.left}px`;
  cropOverlay.style.top = `${canvasRect.top - parentRect.top}px`;
  cropOverlay.style.width = `${canvasRect.width}px`;
  cropOverlay.style.height = `${canvasRect.height}px`;
}

function startCrop() {
  if (!originalImg) {
    showMessage("Please upload an image first.");
    return;
  }
  isCropping = true;
  cropOverlay.style.display = "block";
  updateCropOverlayPosition();

  const canvasRect = canvas.getBoundingClientRect();
  const minDimension = Math.min(canvasRect.width, canvasRect.height);
  const initialCropSize = minDimension * 0.75;
  cropBox.style.width = `${initialCropSize}px`;
  cropBox.style.height = `${initialCropSize}px`;
  cropBox.style.left = `${(canvasRect.width - initialCropSize) / 2}px`;
  cropBox.style.top = `${(canvasRect.height - initialCropSize) / 2}px`;

  updateCropInputs();

  cropBox.addEventListener("mousedown", startDrag);
  cropBox.querySelectorAll(".crop-handle").forEach((handle) => {
    handle.addEventListener("mousedown", startResize);
  });
  document.addEventListener("mousemove", dragOrResize);
  document.addEventListener("mouseup", endDragOrResize);

  cropXInput.addEventListener("input", updateCropBoxFromInputs);
  cropYInput.addEventListener("input", updateCropBoxFromInputs);
  cropWidthInput.addEventListener("input", updateCropBoxFromInputs);
  cropHeightInput.addEventListener("input", updateCropBoxFromInputs);
}

function cancelCrop() {
  if (!isCropping) return;
  isCropping = false;
  cropOverlay.style.display = "none";
  cropBox.removeEventListener("mousedown", startDrag);
  cropBox.querySelectorAll(".crop-handle").forEach((handle) => {
    handle.removeEventListener("mousedown", startResize);
  });
  document.removeEventListener("mousemove", dragOrResize);
  document.removeEventListener("mouseup", endDragOrResize);

  cropXInput.removeEventListener("input", updateCropBoxFromInputs);
  cropYInput.removeEventListener("input", updateCropBoxFromInputs);
  cropWidthInput.removeEventListener("input", updateCropBoxFromInputs);
  cropHeightInput.removeEventListener("input", updateCropBoxFromInputs);

  showMessage("Crop cancelled.");
}

function startDrag(e) {
  e.preventDefault();
  if (!isCropping) return;
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
}

function startResize(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!isCropping) return;
  isResizing = true;
  resizeHandle = e.target;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
}

function dragOrResize(e) {
  if (!isDragging && !isResizing) return;
  e.preventDefault();

  const canvasRect = canvas.getBoundingClientRect();
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  let newLeft = cropBox.offsetLeft;
  let newTop = cropBox.offsetTop;
  let newWidth = cropBox.offsetWidth;
  let newHeight = cropBox.offsetHeight;

  if (isDragging) {
    newLeft += dx;
    newTop += dy;
  } else if (isResizing) {
    const minSize = 20;
    switch (resizeHandle.className) {
      case "crop-handle tl":
        newWidth -= dx;
        newHeight -= dy;
        newLeft += dx;
        newTop += dy;
        break;
      case "crop-handle tr":
        newWidth += dx;
        newHeight -= dy;
        newTop += dy;
        break;
      case "crop-handle bl":
        newWidth -= dx;
        newHeight += dy;
        newLeft += dx;
        break;
      case "crop-handle br":
        newWidth += dx;
        newHeight += dy;
        break;
      case "crop-handle t":
        newHeight -= dy;
        newTop += dy;
        break;
      case "crop-handle b":
        newHeight += dy;
        break;
      case "crop-handle l":
        newWidth -= dx;
        newLeft += dx;
        break;
      case "crop-handle r":
        newWidth += dx;
        break;
    }

    newWidth = Math.max(minSize, newWidth);
    newHeight = Math.max(minSize, newHeight);
    newLeft = Math.max(0, newLeft);
    newTop = Math.max(0, newTop);

    newWidth = Math.min(newWidth, canvasRect.width - newLeft);
    newHeight = Math.min(newHeight, canvasRect.height - newTop);
  }

  cropBox.style.left = `${newLeft}px`;
  cropBox.style.top = `${newTop}px`;
  cropBox.style.width = `${newWidth}px`;
  cropBox.style.height = `${newHeight}px`;

  dragStartX = e.clientX;
  dragStartY = e.clientY;
}

function endDragOrResize() {
  isDragging = false;
  isResizing = false;
  resizeHandle = null;
  updateCropInputs();
}

function updateCropInputs() {
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;

  const x = Math.round(cropBox.offsetLeft * scaleX);
  const y = Math.round(cropBox.offsetTop * scaleY);
  const width = Math.round(cropBox.offsetWidth * scaleX);
  const height = Math.round(cropBox.offsetHeight * scaleY);

  cropXInput.value = x;
  cropYInput.value = y;
  cropWidthInput.value = width;
  cropHeightInput.value = height;
}

function updateCropBoxFromInputs() {
  if (!isCropping) return;
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;

  let x = parseInt(cropXInput.value) || 0;
  let y = parseInt(cropYInput.value) || 0;
  let width = parseInt(cropWidthInput.value) || 0;
  let height = parseInt(cropHeightInput.value) || 0;

  x = Math.max(0, Math.min(x, canvas.width - (width > 0 ? width : 1)));
  y = Math.max(0, Math.min(y, canvas.height - (height > 0 ? height : 1)));
  width = Math.max(1, Math.min(width, canvas.width - x));
  height = Math.max(1, Math.min(height, canvas.height - y));

  cropBox.style.left = `${x * scaleX}px`;
  cropBox.style.top = `${y * scaleY}px`;
  cropBox.style.width = `${width * scaleX}px`;
  cropBox.style.height = `${height * scaleY}px`;
}

function applyCrop() {
  if (!isCropping || !originalImg) {
    showMessage("Please upload an image and select a crop area first.");
    return;
  }
  showLoader(true);
  const x = parseInt(cropXInput.value);
  const y = parseInt(cropYInput.value);
  const width = parseInt(cropWidthInput.value);
  const height = parseInt(cropHeightInput.value);

  if (width <= 0 || height <= 0) {
    showMessage("Invalid crop dimensions.");
    showLoader(false);
    return;
  }

  const newCanvas = document.createElement("canvas");
  newCanvas.width = width;
  newCanvas.height = height;
  const newCtx = newCanvas.getContext("2d");
  newCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

  canvas.width = newCanvas.width;
  canvas.height = newCanvas.height;
  ctx.drawImage(newCanvas, 0, 0);

  saveHistory();
  cancelCrop();
  showLoader(false);
  showMessage("Image cropped successfully!");
}

// --- Remove & Replace Color ---
function removeAndReplaceColor() {
  if (!originalImg) {
    showMessage("Please upload an image first.");
    return;
  }
  const removeColor = document.getElementById("removeColorPicker").value;
  const tolerance =
    parseInt(document.getElementById("removeColorTolerance").value) || 0;
  const rRemove = parseInt(removeColor.slice(1, 3), 16);
  const gRemove = parseInt(removeColor.slice(3, 5), 16);
  const bRemove = parseInt(removeColor.slice(5, 7), 16);
  const doReplace = replaceEnabledCheckbox.checked;

  showLoader(true);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  if (doReplace) {
    const replaceColor = document.getElementById("newBgColorPicker").value;
    const rReplace = parseInt(replaceColor.slice(1, 3), 16);
    const gReplace = parseInt(replaceColor.slice(3, 5), 16);
    const bReplace = parseInt(replaceColor.slice(5, 7), 16);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const distance = Math.sqrt(
        Math.pow(r - rRemove, 2) +
        Math.pow(g - gRemove, 2) +
        Math.pow(b - bRemove, 2),
      );
      if (distance <= tolerance) {
        data[i] = rReplace;
        data[i + 1] = gReplace;
        data[i + 2] = bReplace;
        data[i + 3] = 255;
      }
    }
  } else {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const distance = Math.sqrt(
        Math.pow(r - rRemove, 2) +
        Math.pow(g - gRemove, 2) +
        Math.pow(b - bRemove, 2),
      );
      if (distance <= tolerance) {
        data[i + 3] = 0; // Set alpha to 0 for transparency
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  saveHistory();
  setCheckerboard(!doReplace);
  showLoader(false);
  showMessage("Color operation applied successfully!");
}

function handleCanvasClick(event) {
  if (!originalImg || isCropping) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const r = pixel[0].toString(16).padStart(2, "0");
  const g = pixel[1].toString(16).padStart(2, "0");
  const b = pixel[2].toString(16).padStart(2, "0");
  const hexColor = `#${r}${g}${b}`;
  document.getElementById("removeColorPicker").value = hexColor;
  document.getElementById("colorCode").value = hexColor;
  showMessage(`Color picked: ${hexColor}`);
}

// --- Export Functions ---
function downloadPDF() {
  if (!originalImg) {
    showMessage("Please upload an image first.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  const imgData = canvas.toDataURL("image/png");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const canvasAspectRatio = canvas.width / canvas.height;
  let imgWidth = pdfWidth - 20;
  let imgHeight = imgWidth / canvasAspectRatio;
  if (imgHeight > pdfHeight - 20) {
    imgHeight = pdfHeight - 20;
    imgWidth = imgHeight * canvasAspectRatio;
  }
  const xOffset = (pdfWidth - imgWidth) / 2;
  const yOffset = (pdfHeight - imgHeight) / 2;
  pdf.addImage(imgData, "PNG", xOffset, yOffset, imgWidth, imgHeight);
  const name = document.getElementById("pdfName").value || "download.pdf";
  pdf.save(name);
  showMessage("Exporting to PDF...");
}

function exportImage() {
  if (!originalImg) {
    showMessage("Please upload an image first.");
    return;
  }
  const exportName = document.getElementById("exportName").value || "image";
  const exportFormat = document.getElementById("exportFormat").value;
  const quality = parseFloat(document.getElementById("exportQuality").value);
  const mimeType = `image/${exportFormat}`;
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        showMessage("Failed to export image. Try a different format.");
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${exportName}.${exportFormat}`;
      link.click();
    },
    mimeType,
    quality,
  );
  showMessage("Image exported successfully!");
}

function exportSVG() {
  if (!originalImg) {
    showMessage("Please upload an image first.");
    return;
  }

  showLoader(true, "Generating SVG...");
  setTimeout(() => {
    try {
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height).data;
      const exportName = document.getElementById("exportName").value || "image";

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;

      // A simple pixel-by-pixel approach for demonstration
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];

          if (a > 0) {
            const hex =
              "#" +
              ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            svgContent += `<rect x="${x}" y="${y}" width="1" height="1" fill="${hex}" />`;
          }
        }
      }

      svgContent += `</svg>`;

      const blob = new Blob([svgContent], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exportName}.svg`;
      link.click();
      URL.revokeObjectURL(url);

      showLoader(false);
      showMessage(
        "SVG file generated. Note: The file may be large and is a pixel-based representation.",
      );
    } catch (error) {
      showLoader(false);
      showMessage("Error generating SVG: " + error.message);
    }
  }, 100);
}

function resetToOriginal() {
  if (!initialImageData) {
    showMessage("No image to reset.");
    return;
  }
  showLoader(true);
  canvas.width = initialImageData.width;
  canvas.height = initialImageData.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(initialImageData, 0, 0);
  document.getElementById("resizeWidth").value = initialImageData.width;
  document.getElementById("resizeHeight").value = initialImageData.height;

  if (
    originalImg.src.startsWith("data:image/png") ||
    originalImg.src.startsWith("data:image/webp")
  ) {
    setCheckerboard(true);
  } else {
    setCheckerboard(false);
  }

  history = [];
  historyIndex = -1;
  saveHistory();
  showLoader(false);
  showMessage("Image reset to original.");
}
