# PySysLink VS Code Extension

A Visual Studio Code extension for **PySysLink**, a block‑diagram simulation environment similar to Simulink.  
This extension provides:

- **Block Editor**: Draw, arrange and connect high‑level blocks in a graphical canvas.  
- **Property Inspector**: Edit block parameters, including expressions and initialization scripts.  
- **Live Simulation**: Launch a Python‑based simulation server (using your selected Python interpreter) and receive progress, display, and plot events in the editor.  
- **Block Palette**: Browse installed block libraries and drag‑and‑drop blocks into your diagram.

---

## 🔧 Prerequisites

1. **Python 3.7+** installed on your system.  
2. **PySysLink Toolkit** installed in your Python environment:  
   ```bash
   pip install pysyslink-toolkit

3. **VS Code Python Extension** by Microsoft (automatically prompted on first run).

---

## 🚀 Features & Quick Start

1. **Open or Create** a `.pslk` model file (JSON).
2. **Launch the Block Editor**:

   * Right‑click your file in Explorer ▶ **Open With** ▶ **PySysLink Block Editor**.
3. **Draw your Diagram**:

   * Drag blocks from the **Block Palette** sidebar onto the canvas.
   * Connect ports by clicking and dragging between blocks.
4. **Edit Parameters**:

   * Select a block ▶ edit its properties (literals or expressions) in the sidebar form.
   * (Optional) Define a top‑level `initScript` in your JSON to run custom initialization code.
5. **Run Simulation**:

   * Click the ▶ “Play” button in the editor toolbar.
   * Watch progress notifications and view display/plot events inline.

---

## 📄 Model JSON Format

Your `.pslk` file is plain JSON:

```jsonc
{
  "version": 1,
  "initScript": "gain = np.sin(angle)",
  "blocks": [
    {
      "id": "block1",
      "label": "Gain",
      "x": 200,
      "y": 150,
      "properties": {
        "angle": "45",
        "gain": "np.sin(angle * pi/180)"
      }
    }
  ],
  "links": [
    /* … */
  ]
}
```

* **`initScript`** (optional): Python code run once before converting block parameters.
* **`properties`**: strings are evaluated as expressions (with `numpy` available as `np`).

---

## ⚙️ Configuration

* **Python Interpreter**: The extension uses the active interpreter from the VS Code Python extension.
* **Toolkit Location**: Make sure `pysyslink-toolkit` is installed in that environment.

---

## 📝 License

Apache License Version 2.0 © Pello Usabiaga

---

