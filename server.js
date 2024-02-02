require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const https = require('https');
const fs = require('fs');
const options = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem'), 'utf8'),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'), 'utf8'),
    passphrase: process.env.SSL_PASSPHRASE
  };

const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMscd 
  });  

  const logActivity = (activity) => {
    console.log(`[${new Date().toISOString()}] ${activity}`);
  };

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Files will be saved in the 'uploads' folder
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const pdfParse = require('pdf-parse');

const mammoth = require('mammoth');
const puppeteer = require('puppeteer');


// Storage variable for docx/PDF/Slides download options

let lastResponseInelligenceNotes = ''; // For Intelligence Notes

let lastResponse = ''; // For Old MIUs

//Variables for Intelligence Product Prompts://

//Intelligence Note System Prompt//

const IntelligenceNoteFormatText = `You are a military analyst. Internalize the following Morning Intelligence Update (MIU) format in the order provided. You must not write anything until I prompt you.

Here’s the format: 

Unclassified

(U): COUNTRY | APLE | Virtual Analyst | DD Month YYYY


Notes: “(U)”  stands for unclassified, “COUNTRY” should be substituted in each MIU based on the topic of the text you read for instance  ISRAEL etc: you do not need the word COUNTRY in the actual header., “APLE | Virtual Analyst” stays the same regardless of MIU topic, “ DD Month YYYY” stands for the current day, month, and year ex: 01 January 2024

Below this is a paragraph of no more than seven sentences: 

(U) The first sentence or “BLUF” aka Bottom Line Up Front should be written in bold, should capture the main issue or development that is of interest to the CENTCOM Commander (the “what”); Write the BLUF in this style: “On DD MON, event or action happened, according to news agency.” Pay attention that the “On DD MON” is the event’s date, not today’s date.  If the day is not provided, provide the month, if the month is not provided at least provide the year. 
Summarize the text in seven sentences 
Sentences must be less than 21 words. 
MIU Format should contain no headers except for “(U): COUNTRY | APLE | Virtual Analyst | DD Month YYYY”
Only the first sentence, the BLUF, should be bolded. 
Important: sentences should follow right after another and not have spaces in between. 
The most important thing of this whole MIU is each sentence must follow the other and be connected into one large paragraph. 
The second most important thing is that only the second sentence is bolded and in emphasis.`


//MIU Old Format System Prompt//

const miuFormatText = `Act as if you are an intelligence analyst within the U.S. Intelligence Community who strictly follows the analytic standards of U.S. Intelligence Community Directive 203 and the Defense Intelligence Agency's style guide.

Also, internalize the following format; do not write anything yet. This is called MIU format, and you will operate within its parameters.

  MIU Header Format:

  Classification: capitalize it and bold it

  COUNTRY NAME: “write a title in bold The First Letter of The Word Should be Capitalized”

  Do not preface the country with country: or the title with title:

  To start MIU format you will need a header; see above for the format of that.

  Following MIU format, determine classification, write it with emphasis. Assume most plain text is unclassified, so write “Classification: Unclassified” unless specified otherwise.

  You will next determine the country name, read the plain text and choose the country name that is the main subject of the plain text. Do not have the words COUNTRY NAME in the MIU Header Format. with the true name of the subject country and make the country name in all caps. After you determine the actual country name, put a colon in emphasis after it.

  Next following MIU format, add a space after the colon and write a title, capitalizing the first letter of each word. Read the plain text and write a professional title that summarizes the text. This title should be written in emphasis or bold.

  MIU Body Format: (Do not include these words 'MIU Body Format' in your response. This is just so that you understand the organization of the MIU format.)

  Classification: put classification here “Unclassified” unless otherwise specified

  5. The first sentence or two of the body under the MIU header should be labeled “Executive Summary:” in emphasis of the article or the topic being relayed.

  6. The rest of the MIU body should be a clear and concise 2-4 sentences expanding on the topic at hand that make one paragraph. Label it “Details:” in emphasis.

  7. Avoid unnecessary information and keep the brief to the point without losing the important details.

  8. Under Details create a singular sub bullet and label it “Historical Context:'' in emphasis. Put relevant and historical information that is older than 48 hours here. This section must be no more than one to two sentences.

  9. After the sub bullet, write an “Analyst Comment:” in emphasis. This is where your own assessment takes place, you cannot add new information in the assessment that has not previously been mentioned.

  General rules:

  If you receive any plain text that says the words “advertisement,” “ad,” and “scroll down;” these phrases and phrases like these are advertisements from a site that have been copied and pasted by mistake, use your best judgment and forgo text like these from the MIU Format.

  Do not include sentences or disclaimers like the following at the end of your response: "The content of the remaining portion of the plain text does not provide pertinent information for this report and is thus not included in the analysis." Just simply leave out impertinent information wihtout mentioning it.

  You are summarizing inputted plain text in the MIU format. You are not endorsing plain text’s contents.

  A reminder you must follow and operate under MIU Format: the header, the body, sub bullet if necessary, and analyst comment.`;

const app = express();
const PORT = process.env.PORT || 8080;

const apiKey = process.env.OPENAI_API_KEY;

app.use(express.json());
app.use(express.static('.'));
app.use(limiter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/IndexPlugin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'IndexPlugin.html'));
});

app.get('/IntelligenceNotes.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'IntelligenceNotes.html'));
});

//URL Sources Upload Functions://

//MIU Old Format URL Upload Function//

app.post('/chat', async (req, res) => {
    try {
        const url = req.body.url;
       
        if (!url || !url.startsWith('http')) {
            res.status(400).json({ error: 'Invalid URL' });
            return;
          }

        // Fetch and parse the content of the webpage
        const webpageResponse = await axios.get(url);
        logActivity(`Fetched content from ${url}`);
        const $ = cheerio.load(webpageResponse.data);

        $('script').remove();
        $('style').remove();
        $('.ad').remove();          // Removes elements with class "ad"
        $('#ad-container').remove(); // Removes element with id "ad-container"
        $('iframe').remove();       // Removes all iframe elements, which are sometimes used for ads
        $('.popup').remove();  // Removes elements with class "popup"
        $('#somePopupId').remove();  // Removes element with id "somePopupId"
        $('.hidden').remove();  // Removes elements with class "hidden"
        $('[hidden="true"]').remove();  // Removes elements with attribute hidden="true"
        $('[style*="display: none"]').remove();  // Removes elements with inline style display: none
        $('[style*="visibility: hidden"]').remove();  // Removes elements with inline style visibility: hidden

        const webpageText = $('body').text();
        

        // Send the content to Chat GPT for summarization
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo-1106',
          messages: [{
              role: "system",
              content: miuFormatText  // Referencing the miuFormatText variable here
          }, {
                role: "user",
                content: `Following the standards of U.S. Intelligence Community Directive 203, the U.S. Defense Intelligence Agency's style guide, and the format you internalized, write a MIU report using the following web page/document as your source: ${webpageText}`
            }],
            max_tokens: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
            const chatResponse = response.data.choices[0].message.content.trim();
            
            // Store the response in lastResponse
            lastResponse = chatResponse;

            // Add a console log to indicate when the variable is saved
            console.log('lastResponse has been updated:', lastResponse);
            
            logActivity(`Successfully summarized content from ${url}`);
            res.json({ message: chatResponse });
        } else {
            throw new Error("Unexpected response structure from OpenAI API.");
        }

    } catch (error) {
        logActivity(`Error processing /chat request: ${error.message}`);
        console.error("Error processing /chat request:", error);
        if (error.response && error.response.data && error.response.data.error) {
            logActivity(`OpenAI API Error: ${error.response.data.error}`);
            console.error("OpenAI API Error:", error.response.data.error);
        } else {
            logActivity(`General Error: ${error.message}`);
        }
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

//Intelligence Note URL Upload Function//

app.post('/chatIntelligenceNote', async (req, res) => {
  try {
      const url = req.body.url;
     
      if (!url || !url.startsWith('http')) {
          res.status(400).json({ error: 'Invalid URL' });
          return;
        }

      // Fetch and parse the content of the webpage
      const webpageResponse = await axios.get(url);
      logActivity(`Fetched content from ${url}`);
      const $ = cheerio.load(webpageResponse.data);

      $('script').remove();
      $('style').remove();
      $('.ad').remove();          // Removes elements with class "ad"
      $('#ad-container').remove(); // Removes element with id "ad-container"
      $('iframe').remove();       // Removes all iframe elements, which are sometimes used for ads
      $('.popup').remove();  // Removes elements with class "popup"
      $('#somePopupId').remove();  // Removes element with id "somePopupId"
      $('.hidden').remove();  // Removes elements with class "hidden"
      $('[hidden="true"]').remove();  // Removes elements with attribute hidden="true"
      $('[style*="display: none"]').remove();  // Removes elements with inline style display: none
      $('[style*="visibility: hidden"]').remove();  // Removes elements with inline style visibility: hidden

      const webpageText = $('body').text();
      

      // Send the content to Chat GPT for summarization
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo-1106',
        messages: [{
            role: "system",
            content: IntelligenceNoteFormatText  // Referencing the miuFormatText variable here
        }, {
              role: "user",
              content: `Following the standards of U.S. Intelligence Community Directive 203, the U.S. Defense Intelligence Agency's style guide, and the format you internalized, write a MIU report using the following web page/document as your source: ${webpageText}`
            }],
          max_tokens: 1000
      }, {
          headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
          }
      });

      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
          const chatResponse = response.data.choices[0].message.content.trim();
          
          // Store the response in lastResponseInelligenceNotes
          lastResponseInelligenceNotes = chatResponse;

          // Add a console log to indicate when the variable is saved
          console.log('lastResponseInelligenceNotes has been updated:', lastResponseInelligenceNotes);
          
          logActivity(`Successfully summarized content from ${url}`);
          res.json({ message: chatResponse });
      } else {
          throw new Error("Unexpected response structure from OpenAI API.");
      }

  } catch (error) {
      logActivity(`Error processing /chat request: ${error.message}`);
      console.error("Error processing /chat request:", error);
      if (error.response && error.response.data && error.response.data.error) {
          logActivity(`OpenAI API Error: ${error.response.data.error}`);
          console.error("OpenAI API Error:", error.response.data.error);
      } else {
          logActivity(`General Error: ${error.message}`);
      }
      res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Function to extract text from PDF files
async function extractTextFromPDF(pdfPath) {
    const dataBuffer = fs.readFileSync(pdfPath);
    try {
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (error) {
        throw new Error('Failed to extract text from PDF.');
    }
}

// Function to extract text from DOCX files
async function extractTextFromDOCX(docxPath) {
    const content = fs.readFileSync(docxPath, 'binary');
    const zip = new PizZip(content);
    let doc;
    try {
        doc = new Docxtemplater(zip);
    } catch (error) {
        throw new Error('Error processing DOCX file.');
    }
    return doc.getFullText();
}

//Docx and PDF Sources Upload Functions://

//MIU Old Format Docx and PDF Sources Upload Function//

app.post('/upload-file', upload.single('file'), async (req, res) => {
    if (!req.file) {
        logActivity('No file uploaded.');
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const fileType = req.file.mimetype;
    let text;
    
    try {
        if (fileType === 'application/pdf') {
            // Handle PDF file
            logActivity('Processing PDF file upload.');
            text = await extractTextFromPDF(req.file.path);
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Handle DOCX file
            logActivity('Processing DOCX file upload.');
            text = await extractTextFromDOCX(req.file.path);
        } else {
            throw new Error('Unsupported file type.');
        }

        logActivity('Sending extracted text to ChatGPT.');
        const processedText = await processText(text); // Assuming processText sends to ChatGPT
        
         // Store the response in lastResponse
         lastResponse = processedText;

         // Add a console log to indicate when the variable is saved
         console.log('lastResponse has been updated:', lastResponse);
        
        logActivity('Received response from ChatGPT.');
        res.json({ message: processedText }); // Send a JSON response
    } catch (error) {
        logActivity(`Error processing text: ${error.message}`);
        res.status(500).json({ error: `Error processing text: ${error.message}` }); // Send a JSON error response
    } finally {
        // Clean up the uploaded file
        fs.unlinkSync(req.file.path);
        logActivity('Cleaned up uploaded file.');
    }
});

  
  const processText = async (text) => {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo-1106',
        messages: [{
          role: "system",
          content: miuFormatText  // Referencing the miuFormatText variable here
        }, {
          role: "user",
          content: `Following the standards of U.S. Intelligence Community Directive 203, the U.S. Defense Intelligence Agency's style guide, and the format you internalized, write a MIU report using the following web page/document as your source: ${text}`
        }],
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
  
      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error("Unexpected response structure from OpenAI API.");
      }
    } catch (error) {
      console.error('Error processing text:', error);
      throw error; // Rethrow the error to handle it in the calling function
    }
  };  

  //Intelligence Notes Docx and PDF Sources Upload Function//

  app.post('/upload-fileIntelligenceNote', upload.single('file'), async (req, res) => {
    if (!req.file) {
        logActivity('No file uploaded.');
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const fileType = req.file.mimetype;
    let text;
    
    try {
        if (fileType === 'application/pdf') {
            // Handle PDF file
            logActivity('Processing PDF file upload.');
            text = await extractTextFromPDF(req.file.path);
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Handle DOCX file
            logActivity('Processing DOCX file upload.');
            text = await extractTextFromDOCX(req.file.path);
        } else {
            throw new Error('Unsupported file type.');
        }

        logActivity('Sending extracted text to ChatGPT.');
        const processedText = await processTextIntelligenceNote(text); // Assuming processText sends to ChatGPT
        
        // Store the response in lastResponseInelligenceNotes
        lastResponseInelligenceNotes = processedText;

        // Add a console log to indicate when the variable is saved
        console.log('lastResponseInelligenceNotes has been updated:', lastResponseInelligenceNotes);
        
        logActivity('Received response from ChatGPT.');
        res.json({ message: processedText }); // Send a JSON response
    } catch (error) {
        logActivity(`Error processing text: ${error.message}`);
        res.status(500).json({ error: `Error processing text: ${error.message}` }); // Send a JSON error response
    } finally {
        // Clean up the uploaded file
        fs.unlinkSync(req.file.path);
        logActivity('Cleaned up uploaded file.');
    }
});

  
  const processTextIntelligenceNote = async (text) => {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo-1106',
        messages: [{
          role: "system",
          content: IntelligenceNoteFormatText  // Referencing the miuFormatText variable here
        }, {
          role: "user",
          content: `Following the standards of U.S. Intelligence Community Directive 203, the U.S. Defense Intelligence Agency's style guide, and the format you internalized, write a MIU report using the following web page/document as your source: ${text}`
        }],
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
  
      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error("Unexpected response structure from OpenAI API.");
      }
    } catch (error) {
      console.error('Error processing text:', error);
      throw error; // Rethrow the error to handle it in the calling function
    }
  };  

  // Download Response as Docx Function //

  // Old MIU Reports Function //

  app.get('/download', (req, res) => {
    try {
        // Check if lastResponse is empty or null
        if (!lastResponse) {
            return res.status(400).json({ error: 'No data available for download.' });
        }

        // Create a new DOCX document using docxtemplater
        const content = fs.readFileSync('downloadtemplate.docx', 'binary'); // Load your template file
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip);

        // Replace the template variables with the data from lastResponse
        const data = {
            content: lastResponse // Assuming lastResponse contains the data you want to insert into the document
        };
        doc.setData(data);
        doc.render();

        // Generate the DOCX file
        const buffer = doc.getZip().generate({ type: 'nodebuffer' });

        // Set response headers for downloading the file
        res.setHeader('Content-Disposition', 'attachment; filename=MIU Old Format.docx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);
    } catch (error) {
        console.error('Error generating and sending DOCX file:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

 // Intelligence Notes //

 app.get('/downloadIntelligenceNotes', (req, res) => {
  try {
      // Check if lastResponseInelligenceNotes is empty or null
      if (!lastResponseInelligenceNotes) {
          return res.status(400).json({ error: 'No data available for download.' });
      }

      // Create a new DOCX document using docxtemplater
      const content = fs.readFileSync('IntelligenceNotesTemplate.docx', 'binary'); // Load your template file
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip);

      // Replace the template variables with the data from lastResponseInelligenceNotes
      const data = {
          content: lastResponseInelligenceNotes // Assuming lastResponseInelligenceNotes contains the data you want to insert into the document
      };
      doc.setData(data);
      doc.render();

      // Generate the DOCX file
      const buffer = doc.getZip().generate({ type: 'nodebuffer' });

      // Set response headers for downloading the file
      res.setHeader('Content-Disposition', 'attachment; filename=Intelligence Note.docx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(buffer);
  } catch (error) {
      console.error('Error generating and sending DOCX file:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Download Response as PDF Function //

//Old MIU Format //

// Define your route for generating and downloading PDF files
app.get('/downloadMIUPDF', async (req, res) => {
  try {
    // Check if lastResponse is empty or null
    if (!lastResponse) {
      return res.status(400).json({ error: 'No data available for download.' });
    }

    // Create a new DOCX document using docxtemplater
    const content = fs.readFileSync('downloadtemplate.docx', 'binary'); // Load your template file
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip);

    // Replace the template variables with the data from lastResponse
    const data = {
        content: lastResponse // Assuming lastResponse contains the data you want to insert into the document
    };
    doc.setData(data);
    doc.render();

    // Generate the DOCX buffer
    console.log('Generating DOCX buffer...');
    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' });
    console.log('DOCX buffer filled with data.');

    // Check if the DOCX buffer is empty
    if (!docxBuffer || docxBuffer.length === 0) {
      return res.status(500).json({ error: 'Empty DOCX buffer.' });
    }

    // Create a temporary DOCX file
    const tempDocxPath = `${__dirname}/temp.docx`;
    fs.writeFileSync(tempDocxPath, docxBuffer);

    // Use mammoth to convert the temporary DOCX file to HTML
    console.log('Converting DOCX to HTML...');
    const { value: htmlContent } = await mammoth.convertToHtml({ path: tempDocxPath });
    console.log('DOCX converted to HTML.');

    // Delete the temporary DOCX file
    fs.unlinkSync(tempDocxPath);

    // Use puppeteer to convert HTML to PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf();

    await browser.close();

    // Set the response headers for downloading the PDF file
    res.setHeader('Content-Disposition', 'attachment; filename=Intelligence Note.pdf');
    res.setHeader('Content-Type', 'application/pdf');

    // Send the generated PDF as the response
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Error generating and sending PDF file:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

//Intelligence Notes //

// Define your route for generating and downloading PDF files
app.get('/downloadIntelligenceNotesPDF', async (req, res) => {
  try {
    // Check if lastResponseInelligenceNotes is empty or null
    if (!lastResponseInelligenceNotes) {
      return res.status(400).json({ error: 'No data available for download.' });
    }

    // Create a new DOCX document using docxtemplater
    const content = fs.readFileSync('IntelligenceNotesTemplate.docx', 'binary'); // Load your template file
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip);

    // Replace the template variables with the data from lastResponseInelligenceNotes
    const data = {
        content: lastResponseInelligenceNotes // Assuming lastResponseInelligenceNotes contains the data you want to insert into the document
    };
    doc.setData(data);
    doc.render();

    // Generate the DOCX buffer
    console.log('Generating DOCX buffer...');
    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' });
    console.log('DOCX buffer filled with data.');

    // Check if the DOCX buffer is empty
    if (!docxBuffer || docxBuffer.length === 0) {
      return res.status(500).json({ error: 'Empty DOCX buffer.' });
    }

    // Create a temporary DOCX file
    const tempDocxPath = `${__dirname}/tempIntelligenceNotes.docx`;
    fs.writeFileSync(tempDocxPath, docxBuffer);

    // Use mammoth to convert the temporary DOCX file to HTML
    console.log('Converting DOCX to HTML...');
    const { value: htmlContent } = await mammoth.convertToHtml({ path: tempDocxPath });
    console.log('DOCX converted to HTML.');

    // Delete the temporary DOCX file
    fs.unlinkSync(tempDocxPath);

    // Use puppeteer to convert HTML to PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf();

    await browser.close();

    // Set the response headers for downloading the PDF file
    res.setHeader('Content-Disposition', 'attachment; filename=Intelligence Note.pdf');
    res.setHeader('Content-Type', 'application/pdf');

    // Send the generated PDF as the response
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Error generating and sending PDF file:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


  //Start-up and Shut-down Functions//

  const server = app.listen(PORT, () => {
    logActivity(`Server started on port ${PORT}`);
    console.log(`Server is running on http://localhost:${PORT}`);

    process.on('SIGTERM', () => {
        console.log('SIGTERM signal received. Shutting down gracefully.');
        server.close(() => {
            console.log('Server closed');
        });
    });
});
