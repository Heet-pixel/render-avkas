/* =========================================================
   forms.js – every <form class="avkas-form"> on the site
   Validates, sends with fetch (the visitor never leaves the page),
   shows "Submitting...", retries automatically, shows success / error.
   ========================================================= */
(function () {
  var api = window.AvkasApi;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE = /^[+()\-\s\d]{7,18}$/;
  var MAX_FILE = 5 * 1024 * 1024;

  document.querySelectorAll("form.avkas-form").forEach(initForm);

  function initForm(form) {
    var endpoint = window.AVKAS_CONFIG.API[form.getAttribute("data-endpoint")];
    var successMsg = form.getAttribute("data-success");
    var cta = form.getAttribute("data-cta");
    var button = form.querySelector('button[type="submit"]');
    var box = form.querySelector(".form-msg");
    var busy = false;
    var submissionId = null; // one id per "version" of the form (retries & double-clicks reuse it)
    var slowTimer = null;

    function show(kind, text) {
      box.innerHTML = "";
      if (!kind) return;
      var p = document.createElement("p");
      p.className = kind;
      p.setAttribute("role", kind === "bad" ? "alert" : "status");
      var tel = "+91 84019 89798";
      var i = kind === "bad" ? text.indexOf(tel) : -1;
      if (i !== -1) {
        p.appendChild(document.createTextNode(text.slice(0, i)));
        var a = document.createElement("a");
        a.href = "tel:+918401989798";
        a.textContent = tel;
        a.style.color = "inherit";
        a.style.fontWeight = "700";
        p.appendChild(a);
        p.appendChild(document.createTextNode(text.slice(i + tel.length)));
      } else p.textContent = text;
      box.appendChild(p);
      if (kind === "ok" || kind === "bad") { try { p.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {} }
    }

    // editing any field starts a new id; focusing wakes the backend (throttled)
    form.addEventListener("input", function () { submissionId = null; });
    form.addEventListener("focusin", function () { api.wakeBackend(); });

    form.addEventListener("submit", async function (e) {
      e.preventDefault(); // never navigate – the visitor stays on this page
      if (busy) return;

      var fd = new FormData(form);
      var firstBad = null;
      form.querySelectorAll(".field").forEach(function (box2) {
        var name = box2.getAttribute("data-name");
        var type = box2.getAttribute("data-type");
        var required = box2.getAttribute("data-required") === "true";
        var input = box2.querySelector("input, textarea");
        var err = null;

        if (type === "file") {
          var file = fd.get(name);
          if (required && (!file || !file.size)) err = "Please attach your resume.";
          else if (file && file.size) {
            if (file.size > MAX_FILE) err = "File must be 5MB or smaller.";
            else if (!/\.(pdf|docx?)$/i.test(file.name)) err = "Only PDF, DOC or DOCX files are allowed.";
          }
        } else {
          var v = String(fd.get(name) || "").trim();
          if (required && !v) err = "This field is required.";
          else if (v && type === "email" && !EMAIL.test(v)) err = "Enter a valid email address.";
          else if (v && type === "tel" && !PHONE.test(v)) err = "Enter a valid phone number.";
        }

        var old = box2.querySelector(".err");
        if (old) old.remove();
        input.removeAttribute("aria-invalid");
        if (err) {
          var p = document.createElement("p");
          p.className = "err";
          p.setAttribute("role", "alert");
          p.textContent = err;
          box2.appendChild(p);
          input.setAttribute("aria-invalid", "true");
          if (!firstBad) firstBad = input;
        }
      });
      if (firstBad) { firstBad.focus(); return; }

      if (!submissionId) submissionId = api.newSubmissionId();
      fd.set("submissionId", submissionId);

      busy = true;
      button.disabled = true;
      button.textContent = "Submitting...";
      show(null);
      api.wakeBackend(true); // make sure it is waking while we send

      var result = await api.postForm(endpoint, fd);

      clearTimeout(slowTimer);
      busy = false;
      button.disabled = false;
      button.textContent = cta;
      if (result.ok) {
        show("ok", successMsg);
        submissionId = null; // next message gets a fresh id
        form.reset();
      } else {
        show("bad", result.error);
      }
    });
  }
})();
