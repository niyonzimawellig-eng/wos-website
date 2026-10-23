const express = require('express');
const path = require('path');
const fs = require('fs'); // Ibi bituma mudasobwa ibasha kwandika amafayile
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/submit-request', (req, res) => {
    const { name, phone, email, service, details } = req.body;
    
    // Nshingiro y'amakuru agiye kujya muri Excel (CSV)
    const dataRow = `"${name}","${phone}","${email}","${service}","${details.replace(/\n/g, " ")}"\n`;
    const filePath = path.join(__dirname, 'ubusabe.csv');
    
    // Niba ifayile itaraho, reka tuyikore tuyishyireho imitwe y'imibare (Headers)
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "Amazina,Telefone,Imeli,Serivisi,Ibisobanuro\n");
    }
    
    // Ongeraho amakuru mashya muri ya fayile
    fs.appendFileSync(filePath, dataRow);
    
    console.log(`[WOS] Amakuru ya ${name} yabitswe mu ifayile ya ubusabe.csv!`);
    
    res.send(`
        <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
            <h2 style="color: #22c55e;">Uko byagenze: Ubusabe bwatanzwe neza!</h2>
            <p>Murakoze ${name}, WOS yakiriye amakuru yanyu. Turakuvugisha mu kanya kuri ${phone}.</p>
            <a href="/index.html" style="background: #0f172a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 20px;">Subira ku Rubuga</a>
        </div>
    `);
});

app.listen(PORT, () => {
    console.log(`Server irakora kuri http://localhost:${PORT}`);
});
