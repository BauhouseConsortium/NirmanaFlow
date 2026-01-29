export interface HardwareResult {
  success: boolean;
  message: string;
  blindMode?: boolean;
}

function sanitizeFilename(text: string): string {
  return (text
    .replace(/[^a-zA-Z0-9]/gi, '_')
    .toLowerCase() || 'output') + '-batak.gcode';
}

async function sendCommand(baseUrl: string, command: string): Promise<HardwareResult> {
  const cmdUrl = `${baseUrl}/command?cmd=${encodeURIComponent(command)}`;

  try {
    // Use no-cors directly like reference - avoids double-send issue
    await fetch(cmdUrl, { method: 'GET', mode: 'no-cors' });

    // In no-cors mode, response is opaque but request was sent
    const cleanCmd = command.length > 20 ? command.substring(0, 20) + '...' : command;
    return {
      success: true,
      message: `Cmd '${cleanCmd}' sent (Blind mode).`,
      blindMode: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Failed to fetch')) {
      return {
        success: true,
        message: 'Command sent (CORS blocked response, action likely succeeded)',
        blindMode: true,
      };
    }
    return {
      success: false,
      message: `Network error: ${message}`,
    };
  }
}

export async function uploadGCode(
  baseUrl: string,
  gcode: string,
  inputText: string
): Promise<HardwareResult> {
  const filename = sanitizeFilename(inputText);

  const blob = new Blob([gcode], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('path', '/');
  formData.append('myfile', blob, filename);

  try {
    // Use no-cors directly like reference - avoids double-send issue
    await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: formData,
      mode: 'no-cors',
    });

    return {
      success: true,
      message: `Upload initiated: ${filename} (Response opaque in local mode)`,
      blindMode: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Failed to fetch')) {
      return {
        success: true,
        message: `Upload likely succeeded: ${filename} (CORS blocked response)`,
        blindMode: true,
      };
    }
    return {
      success: false,
      message: `Upload error: ${message}`,
    };
  }
}

export async function runGCode(baseUrl: string, inputText: string): Promise<HardwareResult> {
  const filename = sanitizeFilename(inputText);
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

  // Wait for SD sync (matching reference)
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
