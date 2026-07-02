import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3 className="varuna-brand">VARUNA </h3>
          <p>
            AI-powered ocean and disaster incident analysis, synthesizing NASA EONET, USGS, GDACS and Bluesky data in real time.
          </p>
          <p>
            Every incident is scored for severity and priority to help coordinate a faster emergency response.
          </p>
        </div>
        
        <div className="footer-section">
          <h3>Quick Links</h3>
          <ul>
            <li><a href="/dashboard">Dashboard</a></li>
            <li><a href="/alerts">Critical Alerts</a></li>
            <li><a href="/incidents">Incidents</a></li>
            <li><a href="/chat">Ask VARUNA</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h3>Emergency Services</h3>
          <ul>
            <li><a href="tel:112">Emergency: 112</a></li>
            <li><a href="tel:1078">Coast Guard: 1078</a></li>
            <li><a href="tel:101">Fire Service: 101</a></li>
            <li><a href="tel:108">Ambulance: 108</a></li>
           
          </ul>
        </div>
        
        <div className="footer-section">
          <h3>Government Partnerships</h3>
          <ul>
            <li><a href="https://ndma.gov.in" target="_blank" rel="noopener noreferrer">NDMA</a></li>
            <li><a href="https://incois.gov.in" target="_blank" rel="noopener noreferrer">INCOIS</a></li>
            <li><a href="https://www.indiancoastguard.gov.in" target="_blank" rel="noopener noreferrer">Indian Coast Guard</a></li>
            <li><a href="https://moes.gov.in" target="_blank" rel="noopener noreferrer">Ministry of Earth Sciences</a></li>
     
          </ul>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; 2025 <span className="varuna-brand">VARUNA</span> . All rights reserved.</p>
        <p>Developed for the safety and security of coastal communities across India.</p>
      </div>
    </footer>
  );
};

export default Footer;
