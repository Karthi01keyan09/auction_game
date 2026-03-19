const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'IPL Auction Game API is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
