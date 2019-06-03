const fs = require('fs')
const express = require('express')
const cors = require('cors')

const PORT = 3000

const app = express()
app.use(cors())
app.listen(PORT, () => console.log(`Listening on ${PORT}`))

const loadData = async () =>
  new Promise(resolve => {
    fs.readFile('./5-years.json', (err, data) => {
      if (err) throw err
      resolve(JSON.parse(data))
    })
  })
  
app.get('/data', async (req, res) => {
  const data = await loadData()
  res.status(200)
     .json(data)
})