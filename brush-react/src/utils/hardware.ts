export interface HardwareResult {
  success: boolean;
  message: string;
  blindMode?: boolean;
}

function sanitizeFilename(text: string): string {
  return text
    .substring(0, 20)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

async function sendCommand(baseUrl: string, command: string): Promise<HardwareResult> {
  try {
    const url = `${baseUrl}/command?cmd=${encodeURIComponent(command)}`;

    // Try normal fetch first
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        return { success: true, message: await response.text() };
      }
      return { success: false, message: `Error: ${response.status}` };
    } catch {
      // CORS blocked - try no-cors (blind mode)
      await fetch(url, { mode: 'no-cors' });
      return {
        success: true,
        message: 'Command sent (blind mode - CORS blocked response)',
        blindMode: true,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function uploadGCode(
  baseUrl: string,
  gcode: string,
  inputText: string
): Promise<HardwareResult> {
  const filename = `${sanitizeFilename(inputText)}_batak.gcode`;

  try {
    const formData = new FormData();
    const blob = new Blob([gcode], { type: 'text/plain' });
    formData.append('file', blob, filename);

    try {
      const response = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });

      if (response.ok) {
        return { success: true, message: `Uploaded: ${filename}` };
      }
      return { success: false, message: `Upload failed: ${response.status}` };
    } catch {
      // Try no-cors
      await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        body: formData,
        mode: 'no-cors',
      });
      return {
        success: true,
        message: `Uploaded: ${filename} (blind mode)`,
        blindMode: true,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function runGCode(baseUrl: string, inputText: string): Promise<HardwareResult> {
  const filename = `${sanitizeFilename(inputText)}_batak.gcode`;
  return sendCommand(baseUrl, `$SD/Run=/${filename}`);
}

export async function uploadAndRun(
  baseUrl: string,
  gcode: string,
  inputText: string
): Promise<HardwareResult> {
  const uploadResult = await uploadGCode(baseUrl, gcode, inputText);
  if (!uploadResult.success) {
    return uploadResult;
  }

  // Wait for file to be written
  await new Promise(resolve => setTimeout(resolve, 2000));

  const runResult = await runGCode(baseUrl, inputText);
  return {
    success: runResult.success,
    message: `${uploadResult.message}\n${runResult.message}`,
    blindMode: uploadResult.blindMode || runResult.blindMode,
  };
}

export async function testConnection(baseUrl: string): Promise<HardwareResult> {
  // Send a small wiggle to test Z-axis
  const result1 = await sendCommand(baseUrl, 'G91 G0 Z3');
  if (!result1.success) return result1;

  await new Promise(resolve => setTimeout(resolve, 500));

  const result2 = await sendCommand(baseUrl, 'G91 G0 Z-3');
  return {
    success: result2.success,
    message: result2.success ? 'Connection test successful (Z wiggle)' : result2.message,
    blindMode: result1.blindMode || result2.blindMode,
  };
}
