import { defineConfig, loadEnv, type PluginOption, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { Server as OscServer } from 'node-osc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const poseOutputDir = path.resolve(__dirname, 'src/poses')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const isDev = mode === 'development'
  const enableVmcBridge = env.VITE_ENABLE_VMC_BRIDGE === 'true'
  const enablePoseExport = env.VITE_ENABLE_POSE_EXPORT === 'true'
  const plugins: PluginOption[] = [
    react(),
    enableVmcBridge && {
      name: 'vmc-bridge',
      configureServer(server: ViteDevServer) {
        if (!isDev) {
          console.warn('[vmc-bridge] Skipping setup outside development mode.')
          return
        }
        try {
          console.log('[vmc-bridge] Starting WebSocket server on port 39540...')
          const wss = new WebSocketServer({ port: 39540, host: '127.0.0.1' })
          
          console.log('[vmc-bridge] Starting UDP listener on port 39539...')
          const oscServer = new OscServer(39539, '127.0.0.1', () => {
             console.log('[vmc-bridge] UDP listener active on 39539')
          })

          const handleOscMessage = (msg: any) => {
              // msg is [address, arg1, arg2...]
              const address = msg[0];
              const args = msg.slice(1);
              const json = JSON.stringify({ address, args });
              wss.clients.forEach((client) => {
                  if (client.readyState === 1) { 
                      client.send(json);
                  }
              });
          };

          oscServer.on('message', (msg) => {
              handleOscMessage(msg);
          });

          oscServer.on('bundle', (bundle) => {
              bundle.elements.forEach((element: any) => {
                  if (Array.isArray(element)) {
                      handleOscMessage(element);
                  } else if (element.elements) {
                      element.elements.forEach((subElement: any) => {
                          if (Array.isArray(subElement)) handleOscMessage(subElement);
                      });
                  }
              });
          });

          // Cleanup when Vite server closes
          server.httpServer?.on('close', () => {
              console.log('[vmc-bridge] Closing servers...')
              wss.close()
              oscServer.close()
          })
        } catch (err) {
          console.error('[vmc-bridge] Failed to start:', err)
        }
      }
    },
    enablePoseExport && {
      name: 'pose-export-endpoint',
      configureServer(server: ViteDevServer) {
        if (!isDev) {
          console.warn('[pose-export] Skipping setup outside development mode.')
          return
        }
        server.middlewares.use('/__pose-export', (req: IncomingMessage, res: ServerResponse) => {
          const remoteAddress = req.socket?.remoteAddress
          if (remoteAddress && remoteAddress !== '127.0.0.1' && remoteAddress !== '::1') {
            res.writeHead(403)
            res.end('Forbidden')
            return
          }

          if (req.method !== 'POST') {
            res.writeHead(405)
            res.end('Method not allowed')
            return
          }

          let raw = ''
          const maxBodyBytes = 1024 * 1024
          req.on('data', (chunk: Buffer) => {
            raw += chunk
            if (raw.length > maxBodyBytes) {
              res.writeHead(413)
              res.end('Payload too large')
              req.destroy()
            }
          })
          req.on('end', () => {
            try {
              const payload = JSON.parse(raw || '{}')
              const { poseId, data } = payload
              if (!poseId || !data) {
                res.writeHead(400)
                res.end('Missing poseId or data')
                return
              }
              const safeId = String(poseId).replace(/[^a-zA-Z0-9-_]/g, '')
              const filePath = path.join(poseOutputDir, `${safeId}.json`)
              fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true, filePath }))
            } catch (err) {
              console.error('[pose-export] failed', err)
              res.writeHead(500)
              res.end('Failed to save pose')
            }
          })
        })
      },
    },
  ].filter(Boolean)

  if (!enableVmcBridge) {
    console.log('[vmc-bridge] Disabled. Set VITE_ENABLE_VMC_BRIDGE=true to enable.')
  }
  if (!enablePoseExport) {
    console.log('[pose-export] Disabled. Set VITE_ENABLE_POSE_EXPORT=true to enable.')
  }

  return {
  // Security headers removed to fix black screen issue (blocks external resources)
  // server: {
  //   headers: {
  //     'Cross-Origin-Opener-Policy': 'same-origin',
  //     'Cross-Origin-Embedder-Policy': 'require-corp',
  //   },
  // },
  preview: {
    // headers removed
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    format: 'iife'
  },
  plugins,
  }
})
