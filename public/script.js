const reviewButton = document.getElementById("reviewButton");
const urlInput = document.getElementById("portfolioUrl");

const loading = document.getElementById("loading");
const results = document.getElementById("results");

const errorBox = document.getElementById("error");
const errorMessage = document.getElementById("errorMessage");

const themeToggle = document.getElementById("themeToggle");


/* THEME */

themeToggle.addEventListener("click", function () {

    document.body.classList.toggle("light-mode");

    const light =
        document.body.classList.contains("light-mode");

    themeToggle.textContent =
        light ? "🌙" : "☀️";

    localStorage.setItem(
        "theme",
        light ? "light" : "dark"
    );
});


if (localStorage.getItem("theme") === "light") {

    document.body.classList.add("light-mode");

    themeToggle.textContent = "🌙";
}


/* REVIEW BUTTON */

reviewButton.addEventListener("click", reviewPortfolio);


/* ENTER KEY */

urlInput.addEventListener("keydown", function (event) {

    if (event.key === "Enter") {
        reviewPortfolio();
    }

});


/* REVIEW */

async function reviewPortfolio() {

    let url = urlInput.value.trim();

    if (!url) {

        showError("Please enter a portfolio URL.");

        return;
    }


    /* Add https automatically */

    if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
    ) {
        url = "https://" + url;
    }


    let portfolioUrl;

    try {

        portfolioUrl = new URL(url);

    } catch {

        showError("Please enter a valid website URL.");

        return;
    }


    loading.classList.remove("hidden");
    results.classList.add("hidden");
    errorBox.classList.add("hidden");

    reviewButton.disabled = true;
    reviewButton.textContent = "Analysing...";


    try {

        const response = await fetch("/api/review", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                url: portfolioUrl.href
            })

        });


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.error || "Something went wrong."
            );

        }


        displayResults(data);


    } catch (error) {

        showError(
            error.message ||
            "Something went wrong."
        );

    }


    loading.classList.add("hidden");

    reviewButton.disabled = false;

    reviewButton.textContent =
        "🔥 Roast My Portfolio";
}


/* DISPLAY RESULTS */

function displayResults(data) {

    document.getElementById("reviewedUrl").textContent =
        data.url;


    document.getElementById("overallScore").textContent =
        data.review.overallScore;


    document.getElementById("uiScore").textContent =
        data.review.uiUxScore;


    document.getElementById("performanceScore").textContent =
        data.review.performanceScore;


    document.getElementById("accessibilityScore").textContent =
        data.review.accessibilityScore;


    /* CHART */

    updateChart(
        "overallBar",
        "overallChartScore",
        data.review.overallScore
    );


    updateChart(
        "uiBar",
        "uiChartScore",
        data.review.uiUxScore
    );


    updateChart(
        "performanceBar",
        "performanceChartScore",
        data.review.performanceScore
    );


    updateChart(
        "accessibilityBar",
        "accessibilityChartScore",
        data.review.accessibilityScore
    );


    document.getElementById("roast").textContent =
        data.review.roast;


    document.getElementById("summary").textContent =
        data.review.summary;


    fillList(
        "strengths",
        data.review.strengths
    );


    fillList(
        "improvements",
        data.review.improvements
    );


    results.classList.remove("hidden");

    results.scrollIntoView({
        behavior: "smooth"
    });
}


/* CHART */

function updateChart(barId, scoreId, score) {

    const bar =
        document.getElementById(barId);

    const scoreText =
        document.getElementById(scoreId);


    if (!bar || !scoreText) {
        return;
    }


    const value =
        Math.max(
            0,
            Math.min(
                10,
                Number(score)
            )
        );


    bar.style.width =
        (value * 10) + "%";


    scoreText.textContent =
        value + "/10";
}


/* LISTS */

function fillList(id, items) {

    const list =
        document.getElementById(id);

    list.innerHTML = "";


    if (!Array.isArray(items)) {
        return;
    }


    items.forEach(function (item) {

        const li =
            document.createElement("li");

        li.textContent =
            "→ " + item;

        list.appendChild(li);

    });
}


/* ERROR */

function showError(message) {

    loading.classList.add("hidden");

    errorMessage.textContent =
        message;

    errorBox.classList.remove("hidden");
}


/* RESET */

function resetPage() {

    results.classList.add("hidden");

    errorBox.classList.add("hidden");

    urlInput.value = "";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}