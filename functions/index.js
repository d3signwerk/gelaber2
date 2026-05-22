const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { defineSecret } = require('firebase-functions/params')

initializeApp()

const resendKey = defineSecret('RESEND_KEY')

exports.dailySessionReport = onSchedule(
  {
    schedule: '0 21 * * *',
    timeZone: 'Europe/Berlin',
    secrets: ['RESEND_KEY']
  },
  async () => {
    const db = getFirestore()

    // Logs von heute holen
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const snapshot = await db.collection('sessionLogs')
      .where('timestamp', '>=', today)
      .get()

    if (snapshot.empty) {
      console.log('Keine Sessions heute')
      return
    }

    // Mail-Inhalt aufbauen
    let html = `<h2>gelaber2 - Tagesbericht ${today.toLocaleDateString('de-DE')}</h2>`
    html += `<p><strong>${snapshot.size} Fragen</strong> wurden heute gestellt.</p>`
    html += '<hr/>'

    snapshot.forEach(doc => {
      const d = doc.data()
      const time = d.timestamp?.toDate?.()?.toLocaleTimeString('de-DE') || '-'
      html += `
        <div style="margin-bottom:16px; padding:12px; background:#f5f5f5; border-radius:8px;">
          <p><strong>Zeit:</strong> ${time}</p>
          <p><strong>Patienten-ID:</strong> ${d.patientId || '-'}</p>
          <p><strong>Dokument-ID:</strong> ${d.documentId || '-'}</p>
          <p><strong>Frage:</strong> ${d.question}</p>
          <p><strong>Antwort:</strong> ${d.answer}</p>
        </div>`
    })

    // Mail via Resend senden
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey.value()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'gelaber2@resend.dev',
        to: 'mail@d3signwerk.de',
        subject: `gelaber2 Tagesbericht - ${today.toLocaleDateString('de-DE')}`,
        html: html
      })
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Resend Fehler:', err)
      throw new Error('Mail konnte nicht gesendet werden')
    }

    console.log('Tagesbericht erfolgreich gesendet')
  }
)