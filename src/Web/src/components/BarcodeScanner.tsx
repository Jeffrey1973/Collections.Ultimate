import { useState, useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

interface BarcodeScannerProps {
  onScan: (isbn: string) => void
  onClose: () => void
}

function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [manualIsbn, setManualIsbn] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)

  useEffect(() => {
    startScanning()
    return () => {
      stopScanning()
    }
  }, [])

  async function startScanning() {
    try {
      const codeReader = new BrowserMultiFormatReader()
      codeReaderRef.current = codeReader
      
      const videoInputDevices = await codeReader.listVideoInputDevices()
      
      if (videoInputDevices.length === 0) {
        setError('No camera found. Please enter ISBN manually below.')
        return
      }

      // Prefer back camera on mobile
      const selectedDevice = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back')
      ) || videoInputDevices[0]

      setIsScanning(true)

      codeReader.decodeFromVideoDevice(
        selectedDevice.deviceId,
        videoRef.current!,
        (result, error) => {
          if (result) {
            const isbn = result.getText()
            console.log('Barcode detected:', isbn)
            stopScanning()
            onScan(isbn)
          }
          // Ignore errors - they happen continuously while scanning
        }
      )
    } catch (err) {
      console.error('Camera error:', err)
      setError('Could not access camera. Please allow camera permissions or enter ISBN manually below.')
    }
  }

  function stopScanning() {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset()
    }
    setIsScanning(false)
  }

  function handleClose() {
    stopScanning()
    onClose()
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (manualIsbn.trim()) {
      stopScanning()
      onScan(manualIsbn.trim())
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '500px',
        padding: '1rem',
      }}>
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            backgroundColor: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '1.5rem',
            cursor: 'pointer',
            zIndex: 1001,
          }}
        >
          ×
        </button>

        {error ? (
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
            
            <form onSubmit={handleManualSubmit} style={{ marginTop: '1.5rem' }}>
              <input
                type="text"
                placeholder="Enter ISBN manually"
                value={manualIsbn}
                onChange={(e) => setManualIsbn(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Lookup ISBN
                </button>
                <button type="button" onClick={handleClose} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                borderRadius: '8px',
                backgroundColor: '#000',
              }}
              playsInline
              muted
            />
            
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '8px',
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Position the barcode within the camera view
              </p>
              
              <form onSubmit={handleManualSubmit} style={{ marginTop: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Or enter ISBN manually"
                  value={manualIsbn}
                  onChange={(e) => setManualIsbn(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                  }}
                />
                <button 
                  type="submit" 
                  className="btn btn-secondary" 
                  style={{ width: '100%', fontSize: '0.875rem' }}
                  disabled={!manualIsbn.trim()}
                >
                  Lookup ISBN
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default BarcodeScanner
