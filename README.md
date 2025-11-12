# UNL Classics – Alpheios Retooling

## Modernizing Classical Language Tools for the University of Nebraska–Lincoln

---

### Overview

This project is part of the UNL Computer Science & Engineering Senior Design Program, in collaboration with the UNL Classics Department.  
The goal is to retool and enhance Alpheios, a digital reading and linguistic analysis platform for classical languages, making it more usable 
and accessible for students and instructors through a modern web deployment.

---

### Quick Start
The application is hosted via *GitHub Pages*.  
You can access the live demo at:  
[**https://cseseniordesign.github.io/unl-classics-alpheios-retooling**](https://cseseniordesign.github.io/unl-classics-alpheios-retooling)

---

### Project Structure & Tech Stack

#### Project Structure

unl-classics-alpheios-retooling/  
│  
├── morph/               # Morphological parsing and related logic  
├── tree/                # Treebanking and syntactic structure tools  
├── ui/                  # Interface logic and components (undo, layout, color themes)  
├── xml/                 # XML handling, saving/loading treebank data  
│  
├── main.js              # Core initialization and app logic  
├── treebanking.html     # Main entry page (GitHub Pages)  
├── treebanking.css      # Application styling and color palette  
└── README.md            # This document  

#### Tech Stack

* Front End: HTML, CSS, JavaScript
* Framework: Vanilla JavaScript
* Dependencies: D3 Library, Morpheus
* Deployment: GitHub Pages

---

### Documentation

Full documentation available in the [**Project Wiki**](https://github.com/cseseniordesign/unl-classics-alpheios-retooling/wiki) 

---

### Team Info

* Project Manager: Grant Kerrigan
* Development Manager: Sam DuBois
* Developers: Connor Raatz, Amgad Ahmed, Alaa Ismail, Braelyn Riley

---

### License

You are free to use, modify, and distribute this work with appropriate attribution.

---

### Quick Example / Demo

1) Open web application: [**https://cseseniordesign.github.io/unl-classics-alpheios-retooling**](https://cseseniordesign.github.io/unl-classics-alpheios-retooling).
2) View the tree with preloaded relationships and postags.
3) Click a word on the tree or from the sentence, then click another word to set the latter as the former's head.
4) Click the *Morph* button and then select a word.
5) Choose to either *Delete Form* or *Create new form*
6) Once you are satisfied with your changes, click the save or download button

