/* LINKEDIN POSTS SECTION */
const linkedinPosts = [
  {
    date: "August 2025",
    text: "Nine months ago I walked into NBE carrying nothing but ambition and a lot of questions. The NBE Summer Internship 2025 gave me something I didn't expect — not just banking knowledge, but a real understanding of how institutions operate at scale. From observing customer operations to sitting in rooms where real decisions were made, every day challenged me to think bigger. NBE is more than a bank. For me, it was a classroom with a dress code. #NBESummerInternship2025 #NBE #MoreThanAnInternship",
    link: "https://www.linkedin.com/posts/ziad-bahgat_nbesummerinternship2025-lifeabratabrnbe-morethananinternship-activity-7358614682225602561--xjY?utm_source=share&utm_medium=member_desktop"
  },
  {
    date: "May 2026",
    text: "Four years of studying business. One graduation project to prove it meant something. AXIS is a Human Capital Development Agency built for fresh graduates in Egypt's Delta region — offering 6 to 9 month structured training tracks across Marketing, Finance, and HR, with guaranteed job placement at the end. We're not just another training program. We're the bridge between education and employment that the Delta has been missing. This is the project I'm most proud of. #AXISGraduationProject",
    link: "https://www.linkedin.com/posts/ziad-bahgat_axisgraduationproject-activity-7456364824046796800-EtSO?utm_source=share&utm_medium=member_desktop"
  },
  {
    date: "March 2025",
    text: "Representing Enactus Damanhur at the Global Opportunity Tournament at The British University in Egypt was one of those days that reminded me why I do this. Being in a room full of driven students from across the country — all competing, learning, and pushing each other — was electric. GOT 2025 wasn't just a competition. It was proof that the Delta can show up and show out on any stage. Proud of our team. #EnactusEgypt #GOT2025 #Leadership",
    link: "https://www.linkedin.com/posts/ziad-bahgat_enactusegypt-got2025-leadership-activity-7296537747299688448-5gFX?utm_source=share&utm_medium=member_desktop"
  }
];

function renderLinkedInPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  // Render maximum 6 posts
  const postsToRender = linkedinPosts.slice(0, 6);

  container.innerHTML = postsToRender.map(post => `
    <div class="post-card">
      <span class="post-date">${post.date}</span>
      <p class="post-text">${post.text}</p>
      <a href="${post.link}" target="_blank" rel="noopener" class="post-link">Read on LinkedIn ↗</a>
    </div>
  `).join('');
}

/* SLICE OF MY LIFE */
const lifeSlices = [
  {
    title: "Best Vice of Enactus Damanhur",
    caption: "I didn't join Enactus to win an award. I joined to build something. Being recognized as Best Vice of Enactus Damanhur told me that the late nights, the sessions, the campaigns, and the people I poured energy into — it all landed exactly where it was supposed to.",
    imagePath: "/assets/life/best-vice-enactus.jpg",
    date: "April 2026"
  },
  {
    title: "NBE Summer Internship",
    caption: "Walking into the National Bank of Egypt for the first time felt like stepping into the real version of everything I had been studying. The summer of 2025 taught me that banking is not about numbers — it's about trust, systems, and the people behind them.",
    imagePath: "/assets/life/nbe-internship.jpg",
    date: "Summer 2025"
  },
  {
    title: "Best Member — April 2025",
    caption: "Consistency is quiet work. You show up, you contribute, you care about the details when no one is watching. Being named Best Member of April 2025 wasn't the goal — but it was a good reminder that the work speaks.",
    imagePath: "/assets/life/best-member-april.jpg",
    date: "April 2025"
  },
  {
    title: "Joining Sutherland",
    caption: "September 2025. A new organization, a new challenge, and the same hunger I've always had. Every move I've made has been intentional — and this one is no different.",
    imagePath: "/assets/life/joining-sutherland.jpg",
    date: "September 2025"
  },
  {
    title: "Joining Intelcia",
    caption: "July 2024. My first real corporate role — stepping into a contact center environment and learning what customer experience actually feels like from the inside. Intelcia taught me patience, pressure, and how to keep showing up professionally even on the hardest days.",
    imagePath: "/assets/life/joining-intelcia.jpg",
    date: "July 2024"
  },
  {
    title: "Joining Enactus Damanhur",
    caption: "The decision that changed everything. Joining Enactus Damanhur didn't just add a line to my CV — it rewired how I think about leadership, teamwork, and what it means to create real impact inside a community.",
    imagePath: "/assets/life/joining-enactus-damanhur.jpg",
    date: "2022"
  }
];

function renderLifeSlices() {
  const container = document.getElementById('life-container');
  if (!container) return;

  container.innerHTML = lifeSlices.map(slice => `
    <div class="life-card">
      <div class="life-img-wrap">
        <img src="${slice.imagePath}" alt="${slice.title}" class="life-img" loading="lazy" onerror="this.style.display='none'"> <!-- SEO & PERFORMANCE -->
      </div>
      <div class="life-content">
        <h3 class="life-title">${slice.title}</h3>
        <p class="life-caption">${slice.caption}</p>
        <span class="life-date">${slice.date}</span>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Nav Toggle /* MOBILE QA */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
    
    // Close nav when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
      });
    });
  }

  // Dynamic Year for Footer
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Render Posts
  renderLinkedInPosts();
  
  // Render Life Slices /* SLICE OF MY LIFE */
  renderLifeSlices();
});
