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


// Storage variables for docx/PDF/Slides download options; storing responses iin multi-step functions //

let lastResponseInelligenceNotes = ''; // For Intelligence Notes

let lastResponseATSIntelligenceNote = ``; //ATS Response within Intelligence Note Production

let lastResponse = ''; // For Old MIUs

let lastresponseATS = ``; // For ATS

//Variables for Intelligence Product Prompts://

// ATS System Prompt//

const ATSFormatText = `Internalize these standards and use the standards to analyze the prior assessment.

(U) Analytic Tradecraft Summary

First: Confidence Level: 

State your confidence level in the main assessment 

explain the reason for it by referencing your sources of uncertainty including strengths and weaknesses in the information base, assumptions, gaps, alternatives, and the complexity of the issue. Use the following guide to determine your confidence level, and choose the confidence level that best reflects the assessment. 

Signs that indicate high confidence: 
Well-corroborated information from proven sources; minimal contradictory reporting; low potential for deception; few information gaps. 
Assumptions would not have a significant effect on the assessment if incorrect. 
Very unlikely alternative. 
Routine event that is well understood; relatively few variables. 

Signs that indicate medium confidence:
Partially corroborated information from good sources; some potential for deception; several gaps in the information base. 
Plausible, yet unlikely, alternatives. 
Key assumptions with potentially substantial effect on the assessment if incorrect. 
More complex situation with multiple issues or actors; some previous examples that are well understood. 

Signs that indicate low confidence:
Uncorroborated information; high potential for deception; many critical gaps in the information base. 
Plausible alternatives with a nearly even chance of occurring. 
Key assumptions with substantial effect on the assessment if incorrect. 
Highly complex or rapidly evolving situation with multiple issues or actors; few previous examples that are not well understood.

Second: Sourcing: 

Provide considerable detail on the strengths and weaknesses of the reporting used within the assessment, focusing on the credibility and quality of the sources. Do not provide a summary of what the assessment said. Identify which sources/reporting was the most important to the assessment and its judgment.

Elements of source characterization:
Context 
When did the reported information occur? 
What are the source’s strengths or weaknesses? (subject matter expertise, biases, possible denial and deception, etc.) 
Credibility/Quality 
Is the information credible? Is it of good quality? (accurate, consistent with other reporting, plausible given circumstances) 
Reliability 
Is the source reliable? (vetted, history of reliable reporting) 
Access 
How close is the source to the information? (first-, secondhand, further removed 
Source Types 
Who told us? (informant) 
Who did/said? (actor) 
What is the origin of the reporting? 
What is the type of reporting?

Third: Gaps: 

Include gaps along with a description about the extent to which filling that gap would alter or bolster your assessment. Gaps must be tied to your main assessment if those gaps are critical to and underpin the main judgment. 

Characterize the extent and limits of your knowledge base. What are some remaining gaps that prevent you from making a stronger or more useful assessment and that are not explicitly covered by an assumption or judgment?

Fourth: Assumptions: 

Clearly state a linchpin or gap-bridging assumption(s) underpinning the main assessment. An assumption should help readers understand the connecting tissue between the evidence and the assessment; it generally is something that an analyst believes to be true, but lacks evidence, and if incorrect, would force a change to the assessment. When crafting an assumption, think along the lines of “what would change my assessment?” Identify indicators that could validate or refute assumptions and explain the implication for judgements in assumptions that are incorrect.

Internalize the different assumptions of the text and identify which ones are apparent. 

Framing assumptions:
What longstanding analytic lines are related to the assessment?
What beliefs do the public hold about what “will always,” “will never,” or
“generally will” occur, or what “has always” or “has never” been done
or happened, relative to the question the assessment seeks to answer?
Do we have a default mindset in how we approach this problem?
What are the relevant historical precedents for this question?
Have we identified any trends that we expect to continue?

Scoping assumptions:
What factors, drivers, or variables are not included in the analysis?
What factors are we “holding constant” and assuming will
not change?
Have we assumed that certain events will or will not take place
or that certain factors will or will not change?
Have we clarified which actors, events, and timeframes are and are
not included?
Have we defined all of the key terms and concepts in the analysis?

Evidence assumptions:
Are there multiple possible interpretations of the evidence?
Why do we lean toward one interpretation rather than another?
What beliefs do we hold about the information base that lead us
to ascribe more value to certain pieces of information?
What are the beliefs about the extent of the access to all
relevant information?

Logic assumptions:
Have we used a small sample to infer something about
a broader group?
Have we extrapolated from a known situation to an unknown
situation?
Do we believe that certain types of events or activities are
symptomatic of or more/less likely to occur with some wider
phenomenon or conclusion?
Do we believe that one event or factor is causing or affecting
another event?

Bridging assumptions:
What are the essential elements of information needed to answer the
the problem of the assessment? 
For which elements do we lack evidence? 
For which do we have significant uncertainty?
What are the factors or conditions that must be present for the
assessment to be true (or false), and do we have evidence that they
are (or are not) present?

For each assumption type, determine if they are high impact assumptions, low impact assumptions, and also determine if they are assumptions that are weak or strong. Internalize definitions below. 

(U) High-impact assumptions, if proved false, invalidate or significantly alter
the assessment.

(U) Low-impact assumptions, if proved false, change only an aspect of the assessment,
such as the scope, specificity, likelihood, or timeframe.

(U) An assumption is weak or vulnerable if we can imagine a plausible situation, or
multiple situations, in which the assumption might not be true.

(U) An assumption is strong if we have difficulty imagining a situation in which
the assumption might not be true because such a circumstance is highly unlikely
or implausible.

Based on what you read, choose between high-impact assumptions and low-impact assumptions to characterize the text. Also choose between if the assumption is either weak or strong. 

Fifth: Alternatives: 

Include a plausible and useful alternative to your main assessment. Explain the reasoning and/or evidence that underpins the alternatives. Discuss the alternative likelihood or implications related to United States interests. Identify indicators that, if identified, would affect the likelihood of the alternatives.

First, identify the sources of the uncertainty that bound the understanding of a problem set. This
can be done as part of a regularly occurring analytic line review or in support of a specific project.

The following questions can identify gaps, assumptions, or different interpretations of evidence that can generate alternatives: 

What prevents an analyst from being absolutely certain that the authoritative judgment is correct?
What limits the confidence level?
What are the assessment’s underlying assumptions, and under what conditions might
they prove false?
What are the weaknesses of the information base?
Is there any contradictory reporting?
Could there be denial and deception, deliberate falsification, or other misinformation
that could affect the analysis?
Are we over relying, or relying exclusively, on one collection stream
or platform?
Second, consider alternative hypotheses. Discussing these can enable better detection of future
events or developments that change the authoritative assessment. Ask:
What other hypotheses or options did we consider, and are they plausible?
Are there multiple explanations for the information we have?

How vulnerable is the assessment to change?
What would have to change to make an analyst reconsider the expected outcome?
What indicators of change would we expect to be captured with the collection assets?
What indicators do we think we could not observe?
Finally, consider the implications of the assessments for the clients in order to mitigate surprise,
allow for planning, and provide warning:
What are the implications for U.S. interests if we are wrong about the assessment?
What types of plausible events would be game changers, that is, would fundamentally shift
the issues of import or outcomes we currently anticipate? What would the implications be?
How would we know that the alternative is becoming likely or that the authoritative assessment
is becoming unlikely?
Next address the elements below to ensure the alternatives presented in every product are useful, plausible, and rigorous.
What is the alternative to the authoritative assessment?
What is its likelihood (relative and absolute)? Some alternatives may be highly unlikely, whereas
others may not be significantly less likely than the authoritative assessment.
What reasoning and/or evidence substantiates the plausibility of the alternative? Explain
the support for the alternative, rather than using the alternative to bolster the case for the
authoritative assessment.
What are the implications for U.S. interests of the alternative that warrant consideration?
When appropriate, what indicators would, if observed, affect the likelihood of the alternative
and the authoritative assessment?

Internalize approaches to writing alternative assessments. 

Exploring the Potential for Surprise. This approach to analysis of alternatives examines the
impact of a hard-to-predict event or a surprise to facilitate contingency planning. It includes
collectible, specific indicators to provide warning.

Competing Assessments. This approach clarifies the alternative’s strengths and weaknesses
as compared with the authoritative assessment. This type of alternative can be, but is not limited
to, a competing view from another IC element. Addressing alternatives can enhance the credibility of the assessments.

Discussing the Implications of Information or Assumptions. This approach examines the
impact of key information or assumptions on the judgments, allowing clients to determine
whether contingency planning is needed. Indicators are highlighted, as appropriate, in the product.

These directions internalized write at least two alternatives to the initial assessment. 
`

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

// Reference Doocument Varaiables//

const ICDStandards = `Please internalize the following documents for reference. Once you have received them please respond only with the following text 'Received.' Document #1 is called Intelligence Community Directive 203 Standards and contains the following information:

INTELLIGENCE COMMUNITY DIRECTIVE 203
A. AUTHORITY: The National Security Act of 1947, as amended; the Intelligence Reform and Terrorism Prevention Act of 2004; Executive Order 12333, as amended; Presidential Policy Directive/PPD?28; and other applicable provisions of law. 
B. PURPOSE 
1. This Intelligence Community Directive (ICD) establishes the Intelligence Community (IC) Analytic Standards that govern the production and evaluation of analytic products; articulates the responsibility of intelligence to strive for excellence, integrity, and rigor in their analytic thinking and work practices; and delineates the role of the Of?ce of the Director of National Intelligence (ODNI) Analytic Ombuds. 
2. This Directive supersedes ICD 203, Analytic Standards, dated 21 June 2007, and rescinds ICPM 2006-200-2, Role of the Of?ce oft/1e Director of National Intelligence Analytic Ombudsman. 
C. APPLICABILITY 
1. This ICD applies to the IC, as de?ned by the National Security Act of 1947, as amended; and to such elements of any other department or agency as may be designated an element of the IC by the President, or jointly by the Director of National Intelligence (DNI) and the head of the department or agency concerned. 
2. This Directive does not apply to purely law enforcement information. When law enforcement information also contains intelligence or intelligence-related information, this Directive shall apply only to the intelligence or intelligence-related information and analysis contained therein. 
D. POLICY 
1. The IC Analytic Standards are the core principles of intelligence analysis and are to be applied across the IC. IC Analytic Standards shall be applied in each analytic product in a manner appropriate to its purpose, the type and scope of its underlying source information, its production timeline, and its customers. IC elements may create supplemental analytic standards that are tailored to their particular missions. 
2. The IC Analytic Standards are the foundational assessment criteria for a regular program of review of IC analytic products. Each IC element shall maintain a program of product evaluation using the IC Analytic Standards as the core elements for assessment criteria.
3. The IC. Analytic Standards serve as a common foundation for developing education and training in analytic skills. The results of analytic product evaluations will be used to improve materials and programs for education and training in analytic knowledge, skills, abilities, and tradecraft. 
4. The Standards also promote a common ethic for achieving analytic rigor and excellence, and for personal integrity in analytic practice. Adherence to IC Analytic Standards is safeguarded by the ODNI Analytic Ombuds, who addresses concerns regarding lack of objectivity, bias, politicization, or other issues in Standards application in analytic products. 
5. The Standards promote the protection of privacy and civil liberties by ensuring the objectivity, timeliness, relevance, and accuracy of personally identifiable information (PII) used in analytic products. should include P11 in products only as it relates to a specific analytic purpose necessary to understand the foreign intelligence or counterintelligence information or assess its importance), consistent with IC element mission and in compliance with IC element regulation and policy, including procedures to prevent, identify, and correct errors in 
6. The IC Analytic Standards guide analysis and analytic production. All analytic products shall be consistent with the following Analytic Standards, including the nine Analytic Tradecraft Standards. 
a. Objective: must perform their functions with objectivity and with awareness of their own assumptions and reasoning. They must employ reasoning techniques and practical mechanisms that reveal and mitigate bias. They should be alert to influence by existing analytic positions or judgments and must consider alternative perspectives and contrary information. Analysis should not be unduly constrained by previous judgments when new developments indicate a modi?cation is necessary. 
b. Independent of political consideration: Analytic assessments must not be distorted by, nor shaped for, advocacy of a particular audience, agenda, or policy viewpoint. Analytic judgments must not be influenced by the force of preference for a particular policy. 
c. Timely: Analysis must be disseminated in time for it to be actionable by customers. Analytic elements have the responsibility to be continually aware of events of intelligence interest, of customer activities and schedules, and of intelligence requirements and priorities, in order to provide useful analysis at the right time. 
d. Based on all available sources of intelligence information: Analysis should be informed by all relevant information available. Analytic elements should identify and address critical information gaps and work with collection activities and data providers to develop access and collection strategies. 
e. Implements and exhibits Analytic Tradecraft Standards, specifically: 
(I) Properly describes quality and credibility of underlying sources, data, and methodologies: Analytic products should identify underlying sources and methodologies upon which judgments are based, and use source descriptors in accordance with ICD 206, Sourcing Requirements for Disseminated Analytic Products, to describe factors affecting source quality and credibility. Such factors can include accuracy and completeness, possible denial and deception, age and continued currency of information, and technical elements of collection as well as source access, validation, motivation, possible bias, or expertise. Source summary ix)203 statements, described in 1CD 206, are strongly encouraged and should be used to provide a holistic assessment of the weaknesses in the source base and explain which sources are most important to key analytic judgments. 
(2) Properly expresses and explains uncertainties associated with major analytic judgments: Analytic products should indicate and explain the basis for the uncertainties associated with major analytic judgments, specifically the likelihood of occurrence of an event or development, and the analysts con?dence in the basis for this judgment. Degrees of likelihood encompass a full spectrum from remote to nearly certain. confidence in an assessment or judgment may be based on the logic and evidentiary base that underpin it, including the quantity and quality of source material, and their understanding of the topic. Analytic products should note causes of uncertainty type, currency, and amount of information, knowledge gaps, and the nature of the issue) and explain how uncertainties affect analysis to what degree and how a judgment depends on assumptions). As appropriate, products should identify indicators that would alter the levels of uncertainty for major analytic judgments. Consistency in the terms used and the supporting information and logic advanced is critical to success in expressing uncertainty, regardless of whether likelihood or con?dence expressions are used. For expressions of likelihood or probability, an analytic product must use one of the following sets of terms: almost no chance, very unlikely, roughly likely, very likely, and almost certain. 
(3) Properly distinguishes between underlying intelligence information and assumptions and judgments: Analytic products should clearly distinguish statements that convey underlying intelligence information used in analysis from statements that convey assumptions or judgments. Assumptions are de?ned as suppositions used to frame or support an argument; assumptions affect analytic interpretation of underlying intelligence information. Judgments are de?ned as conclusions based on underlying intelligence information, analysis, and assumptions. Products should state assumptions explicitly when they serve as the linchpin of an argument or when they bridge key information gaps. Products should explain the implications for judgments if assumptions prove to be incorrect. Products also should, as appropriate, identify indicators that, if detected, would alter judgments.
(4) Incorporates analysis alternatives: Analysis of alternatives is the systematic evaluation of different hypotheses to explain events or phenomena, explore near-term outcomes, and imagine possible futures to mitigate surprise and risk. Analytic products should identify and assess plausible alternative hypotheses. This is particularly important when major judgments must contend with significant uncertainties, or complexity forecasting future trends), or when low probability events could produce high-impact results. In discussing alternatives, products should address factors such as associated assumptions, likelihood, or implications related to U.S. interests. Products also should identify indicators that, if detected, would affect the likelihood of identified alternatives. 
(5) Demonstrates customer relevance and addresses implications: Analytic products should provide information and insight on issues relevant to the customers of the intelligence and address the implications of the information and analysis they provide. Products should add value by addressing prospects, context, threats, or factors affecting opportunities for action.
(6) Uses clear and logical argumentation: Analytic products should present a clear main analytic message up front. Products containing multiple judgments should have a main analytic message that is drawn collectively from those judgments. All analytic judgments should be effectively supported by relevant intelligence information and coherent reasoning. Language and syntax should convey meaning unambiguously. Products should be internally consistent and acknowledge significant supporting and contrary information affecting judgments. 
(7) Explains change to or consistency of analytic judgments: Analytic products should state how their major judgments on a topic are consistent with or represent a change from those in previously published analysis, or represent initial coverage of a topic. Products need not be or detailed in explaining change or consistency. They should avoid using boilerplate language, however, and should make clear how new information or different reasoning led to the judgments expressed in them. Recurrent products such as daily crisis reports should note any changes in judgments; absent changes, recurrent products need not con?rm consistency with previous editions. Signi?cant differences in analytic judgment, such as between two 1C analytic elements, should be fully considered and brought to the attention of customers. 
(8) Makes accurate judgments and assessments: Analytic products should apply expertise and logic to make the most accurate judgments and assessments possible, based on the information available and known information gaps. In doing so, analytic products should present all judgments that would be useful to customers, and should not avoid difficult judgments in order to minimize the risk of being wrong. Inherent to the concept of accuracy is that the analytic message a customer receives should be the one the analyst intended to send. Therefore, analytic products should express judgments as clearly and precisely as possible, reducing ambiguity by addressing the likelihood, timing, and nature of the outcome or development. Clarity of meaning permits assessment for accuracy when all necessary information is available. 
(9) Incorporates effective visual information where appropriate: Analytic products should incorporate visual information to clarify an analytic message and to complement or enhance the presentation of data and analysis. In particular, visual presentations should be used when information or concepts spatial or temporal relationships) can be conveyed better in graphic form tables, flow charts, images) than in written text. Visual information may range from plain presentation of intelligence information to interactive displays for complex information and analytic concepts. All of the content in an analytic product may be presented visually. Visual information should always be clear and pertinent to the product's subject. Analytic content in visual information should also adhere to other analytic tradecraft standards.

`;

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

//SEND Reference Documents to ChatGPT on Page Loading//

app.get('/fetchIntelligenceNotes', async (req, res) => {
  console.log('Sending prompt to ChatGPT API...');
  // Send a request to the ChatGPT API
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo-1106',
      messages: [{
          role: "system",
          content: ICDStandards
      }, {
            role: "user",
            content: "Once you have internalized the doucments, respond only with the word 'Recieved'."
        }],
        max_tokens: 3000
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });

    const data = response.data;
    console.log('Received response from ChatGPT API:', data);
    // Here you can process the response from the API as needed

    console.log('Response:', data);

    res.send(data); // Sending the response back to the client
  } catch (error) {
    console.error('Error calling ChatGPT API:', error);
    res.status(500).send('Error calling ChatGPT API');
  }
});

//Display second Response on Client Side//

app.get('/getLastResponseATSIntelligenceNote', (req, res) => {
  try {
      // Return the value of lastResponseATSIntelligenceNote as JSON
      res.json({ lastResponseATSIntelligenceNote });
  } catch (error) {
      console.error('Error retrieving lastResponseATSIntelligenceNote:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
  }
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

      // Removing unwanted elements from the webpage
      $('script').remove();
      $('style').remove();
      $('.ad').remove();          
      $('#ad-container').remove(); 
      $('iframe').remove();       
      $('.popup').remove();  
      $('#somePopupId').remove();  
      $('.hidden').remove();  
      $('[hidden="true"]').remove();  
      $('[style*="display: none"]').remove();  
      $('[style*="visibility: hidden"]').remove();  

      const webpageText = $('body').text();
      
      // Send the content to Chat GPT for summarization
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo-1106',
        messages: [{
            role: "system",
            content: IntelligenceNoteFormatText  
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

          // Now, send a new ChatGPT API request using the last response as part of the prompt
          console.log('Sending follow-up request to ChatGPT...');
          const followUpResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo-1106',
            messages: [{
                role: "system",
                content: ATSFormatText   
            }, {
                role: "user",
                content: `Use that internalized format and instructions to create the Analytic Tradecraft Summary for the following intelligence product: ${lastResponseInelligenceNotes}`            
            }],
            max_tokens: 1000
          }, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          // Save the second response as lastResponseATSIntelligenceNote
          if (followUpResponse.data.choices && followUpResponse.data.choices[0] && followUpResponse.data.choices[0].message && followUpResponse.data.choices[0].message.content) {
            const followUpChatResponse = followUpResponse.data.choices[0].message.content.trim();
            lastResponseATSIntelligenceNote = followUpChatResponse;
            console.log('lastResponseATSIntelligenceNote has been updated:', lastResponseATSIntelligenceNote);
        }

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
        
        logActivity('Received response #1 from ChatGPT.');
        res.json({ message: processedText }); // Send a JSON response

        // Now, send a new ChatGPT API request using the last response as part of the prompt
        console.log('Sending follow-up request to ChatGPT...');
        const followUpResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo-1106',
          messages: [{
              role: "system",
              content: ATSFormatText   
          }, {
              role: "user",
              content: `Use that internalized format and instructions to create the Analytic Tradecraft Summary for the following intelligence product: ${lastResponseInelligenceNotes}`
          }],
          max_tokens: 1000
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        // Save the second response as lastResponseATSIntelligenceNote
        if (followUpResponse.data.choices && followUpResponse.data.choices[0] && followUpResponse.data.choices[0].message && followUpResponse.data.choices[0].message.content) {
          const followUpChatResponse = followUpResponse.data.choices[0].message.content.trim();
          lastResponseATSIntelligenceNote = followUpChatResponse;
          console.log('lastResponseATSIntelligenceNote has been updated:', lastResponseATSIntelligenceNote);
      }

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

  // ATS Docx and PDF Sources Upload Function//

  app.post('/upload-ATS', upload.single('file'), async (req, res) => {
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
        const processedText = await processTextATS(text); // Assuming processText sends to ChatGPT
        
        // Store the response in lastResponseATS
        lastresponseATS = processedText;

        // Add a console log to indicate when the variable is saved
        console.log('lastresponseATS has been updated:', lastresponseATS);
        
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

const processTextATS = async (text) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo-1106',
      messages: [{
        role: "system",
        content: ATSFormatText  // Referencing the miuFormatText variable here
      }, {
        role: "user",
        content: `Use that internalized format and instructions to create the Analytic Tradecraft Summary for the following intelligence product: ${text}`
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
    // Check if lastResponseInelligenceNotes and lastResponseATSIntelligenceNote are empty or null
    if (!lastResponseInelligenceNotes || !lastResponseATSIntelligenceNote) {
      return res.status(400).json({ error: 'No data available for download.' });
    }

    // Load your template file
    const content = fs.readFileSync('IntelligenceNotesTemplate.docx', 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip);

    // Replace the template variables with the data from lastResponseInelligenceNotes and lastResponseATSIntelligenceNote
    const data = {
      lastResponseInelligenceNotes: lastResponseInelligenceNotes,
      lastResponseATSIntelligenceNote: lastResponseATSIntelligenceNote
    };
    doc.setData(data);
    doc.render();

    // Generate the DOCX file
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });

    // Set response headers for downloading the file
    res.setHeader('Content-Disposition', 'attachment; filename=IntelligenceNote.docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating and sending DOCX file:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ATS ///

app.get('/downloadATS', (req, res) => {
  try {
      // Check if lastATS is empty or null
      if (!lastresponseATS) {
          return res.status(400).json({ error: 'No data available for download.' });
      }

      // Create a new DOCX document using docxtemplater
      const content = fs.readFileSync('ATSDownloadFormat.docx', 'binary'); // Load your template file
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip);

      // Replace the template variables with the data from lastresponseATS
      const data = {
          content: lastresponseATS // Assuming lastresponseATS contains the data you want to insert into the document
      };
      doc.setData(data);
      doc.render();

      // Generate the DOCX file
      const buffer = doc.getZip().generate({ type: 'nodebuffer' });

      // Set response headers for downloading the file
      res.setHeader('Content-Disposition', 'attachment; filename=Analytic Tradecraft Summary.docx');
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

// ATS//

// Define your route for generating and downloading PDF files
app.get('/downloadATSPDF', async (req, res) => {
  try {
    // Check if lastResponse is empty or null
    if (!lastResponse) {
      return res.status(400).json({ error: 'No data available for download.' });
    }

    // Create a new DOCX document using docxtemplater
    const content = fs.readFileSync('ATSDownloadFormat.docx', 'binary'); // Load your template file
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip);

    // Replace the template variables with the data from lastresponseATS
    const data = {
        content: lastresponseATS // Assuming lastresponseATS contains the data you want to insert into the document
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
    res.setHeader('Content-Disposition', 'attachment; filename=Analytic Tradecraft Summary.pdf');
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
    
    // Log the port number
    console.log(`Server is running on port ${PORT}`);

    process.on('SIGTERM', () => {
        console.log('SIGTERM signal received. Shutting down gracefully.');
        server.close(() => {
          console.log('Server closed');
        });
    });      
});
