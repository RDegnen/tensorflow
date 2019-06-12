require('dotenv').config()
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const axios = require('axios')

const PORT = 3000
const KEY = process.env.ALPHA_ADVANTAGE_KEY

const app = express()
app.use(cors())
app.listen(PORT, () => console.log(`Listening on ${PORT}`))

const getData = async () => {
  try {
    const res = await axios.get(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=MSFT&outputsize=full&apikey=${KEY}`)
    return res
  } catch(err) {
    console.log(err)
  }
}

const loadData = async () =>
  new Promise(resolve => {
    fs.readFile('./data.json', (err, data) => {
      if (err) throw err
      resolve(JSON.parse(data))
    })
  })
  
const transformData = data => {
  const timeSeriesData = data['Time Series (Daily)']
  return Object.keys(timeSeriesData)
    .sort()
    .map(key => ({ Close: parseFloat(timeSeriesData[key]['4. close']) }))
}

app.get('/data', async (req, res) => {
  // const data = await loadData()
  // res.status(200)
  //    .json(data)

  const data = await getData()
  const transformedData = transformData(data.data)
  res.status(200)
     .json(transformedData)
})