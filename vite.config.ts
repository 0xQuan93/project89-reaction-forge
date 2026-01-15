import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { Server as OscServer } from 'node-osc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const poseOutputDir = path.resolve(__dirname, 'src/poses')

// https://vite.dev/config/
export default defineConfig({
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
  plugins: [
    react(),
    {
      name: 'vmc-bridge',
      configureServer(server) {
        try {
          console.log('[vmc-bridge] Starting WebSocket server on port 39540...')
          const wss = new WebSocketServer({ port: 39540 })
          
          console.log('[vmc-bridge] Starting UDP listener on port 39539...')
          const oscServer = new OscServer(39539, '0.0.0.0', () => {
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
    {
      name: 'pose-export-endpoint',
      configureServer(server) {
        server.middlewares.use('/__pose-export', (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405)
            res.end('Method not allowed')
            return
          }

          let raw = ''
          req.on('data', (chunk) => {
            raw += chunk
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
  ],
})
