import process from 'node:process'

const chunks = []
for await (const chunk of process.stdin) {
  chunks.push(chunk)
}

const sensitiveNames = [
  'MYSQL_PASSWORD',
  'MYSQL_ROOT_PASSWORD',
  'APP_JWT_SECRET',
  'APP_EMPLOYEE_IDENTITY_KEY',
]

let output = Buffer.concat(chunks).toString('utf8')
for (const name of sensitiveNames) {
  const value = process.env[name]
  if (value) {
    output = output.split(value).join('[REDACTED]')
  }
}

process.stdout.write(output)
