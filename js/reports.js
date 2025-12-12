      // Use config values (falling back to inline if config not loaded)
      const SUPABASE_URL = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.URL : "https://smzgfffeehrozxsqtgqa.supabase.co";
      const SUPABASE_ANON_KEY = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.ANON_KEY :
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtemdmZmZlZWhyb3p4c3F0Z3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNTU4NTYsImV4cCI6MjA3NDgzMTg1Nn0.LvIQLvj7HO7xXJhTALLO5GeYZ1DU50L3q8Act5wXfi4";

      const supabase = getSupabase();
      const MAX_CAPACITY = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.MAX_CAPACITY : 15;

      // Note: calculateDays, getMonthName, formatCurrency are now available from utils.js
      // Keeping inline versions as fallback for backwards compatibility
      function calculateDaysLocal(checkIn, checkOut) {
        if (!checkIn || !checkOut) return 0;
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      function getMonthName(monthIndex) {
        const months = [
          "ינואר",
          "פברואר",
          "מרץ",
          "אפריל",
          "מאי",
          "יוני",
          "יולי",
          "אוגוסט",
          "ספטמבר",
          "אוקטובר",
          "נובמבר",
          "דצמבר",
        ];
        return months[monthIndex];
      }

      function formatCurrency(amount) {
        return "₪" + amount.toLocaleString("he-IL");
      }



      function generateBusinessInsights(
        orders,
        thisMonthRev,
        lastMonthRev,
        occupancy,
        topCustomers,
        sizeBreakdown
      ) {
        const insights = [];

        // ניתוח צמיחה
        const revenueGrowth =
          lastMonthRev > 0
            ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100
            : 0;
        if (revenueGrowth > 10) {
          insights.push({
            icon: "🚀",
            title: "צמיחה מרשימה",
            text: `ההכנסות עלו ב-${revenueGrowth.toFixed(
              1
            )}% לעומת החודש הקודם! המגמה חיובית - כדאי לנצל את התנופה ולהשקיע בשיווק.`,
          });
        } else if (revenueGrowth < -10) {
          insights.push({
            icon: "⚠️",
            title: "ירידה בהכנסות",
            text: `ההכנסות ירדו ב-${Math.abs(revenueGrowth).toFixed(
              1
            )}%. כדאי לבדוק: האם יש עונתיות? האם צריך קמפיין שיווקי? מתחרים חדשים באזור?`,
          });
        }

        // ניתוח תפוסה
        const occupancyNum = parseFloat(occupancy);
        if (occupancyNum > 80) {
          insights.push({
            icon: "🎯",
            title: "תפוסה גבוהה",
            text: `תפוסה של ${occupancyNum.toFixed(
              1
            )}% היא מצוינת! אבל זה אומר שאתה מתקרב למקסימום. כדאי לשקול: העלאת מחירים, הרחבת הפנסיון, או העסקת עוזר.`,
          });
        } else if (occupancyNum < 50) {
          insights.push({
            icon: "📢",
            title: "יש מקום לצמיחה",
            text: `תפוסה של ${occupancyNum.toFixed(
              1
            )}% משאירה הרבה פוטנציאל. המלצות: פרסום ממוקד ברשתות החברתיות, הנחות ללקוחות חוזרים, שיתופי פעולה עם וטרינרים.`,
          });
        }

        // ניתוח נאמנות לקוחות
        const repeatCustomers = {};
        orders.forEach((order) => {
          repeatCustomers[order.phone] =
            (repeatCustomers[order.phone] || 0) + 1;
        });
        const loyalCustomers = Object.values(repeatCustomers).filter(
          (count) => count >= 3
        ).length;
        const totalCustomers = Object.keys(repeatCustomers).length;
        const loyaltyRate = (loyalCustomers / totalCustomers) * 100;

        if (loyaltyRate > 30) {
          insights.push({
            icon: "❤️",
            title: "נאמנות לקוחות גבוהה",
            text: `${loyaltyRate.toFixed(
              1
            )}% מהלקוחות שלך חוזרים 3+ פעמים! זה מצוין. תשמור על השירות האיכותי ושקול תוכנית נאמנות (כרטיסייה - 10 ימים ב-1100₪ במקום 1300₪).`,
          });
        } else {
          insights.push({
            icon: "🎁",
            title: "הזדמנות לשיפור נאמנות",
            text: `רק ${loyaltyRate.toFixed(
              1
            )}% מהלקוחות חוזרים. כדאי: לשלוח הודעות תודה, לתת הנחה בביקור השני, ליצור קבוצת WhatsApp ללקוחות קבועים.`,
          });
        }

        // ניתוח 10-90 (20% מהלקוחות מייצרים 80% מההכנסות?)
        const top20PercentCount = Math.ceil(totalCustomers * 0.2);
        const top20Revenue = topCustomers
          .slice(0, top20PercentCount)
          .reduce((sum, c) => sum + c.revenue, 0);
        const totalRevenue = topCustomers.reduce(
          (sum, c) => sum + c.revenue,
          0
        );
        const top20Percentage = (top20Revenue / totalRevenue) * 100;

        if (top20Percentage > 70) {
          insights.push({
            icon: "⭐",
            title: "תלות בלקוחות מובילים",
            text: `${top20Percentage.toFixed(
              1
            )}% מההכנסות מגיעות מ-20% מהלקוחות. זה טוב (לקוחות נאמנים!) אבל גם סיכון. כדאי לגוון ולהביא לקוחות חדשים.`,
          });
        }

        // ניתוח גדלים פופולריים
        const sortedSizes = Object.entries(sizeBreakdown).sort(
          (a, b) => b[1] - a[1]
        );
        const topSize = sortedSizes[0];
        const topSizePercent = (topSize[1] / orders.length) * 100;

        if (topSizePercent > 40) {
          insights.push({
            icon: "🐕",
            title: `התמחות בכלבים ${topSize[0]}`,
            text: `${topSizePercent.toFixed(1)}% מהכלבים הם "${
              topSize[0]
            }". זה יתרון! תוכל לפרסם כמומחה ל${
              topSize[0]
            }, להתאים את הציוד, ולמשוך עוד לקוחות מסוג זה.`,
          });
        }

        // ניתוח עונתיות
        const monthlyDistribution = {};
        orders.forEach((order) => {
          const month = new Date(order.check_in).getMonth();
          monthlyDistribution[month] = (monthlyDistribution[month] || 0) + 1;
        });

        const maxMonth = Object.entries(monthlyDistribution).reduce(
          (max, curr) => (curr[1] > max[1] ? curr : max),
          ["0", 0]
        );
        const minMonth = Object.entries(monthlyDistribution).reduce(
          (min, curr) => (curr[1] < min[1] ? curr : min),
          ["0", 999]
        );

        const monthNames = [
          "ינואר",
          "פברואר",
          "מרץ",
          "אפריל",
          "מאי",
          "יוני",
          "יולי",
          "אוגוסט",
          "ספטמבר",
          "אוקטובר",
          "נובמבר",
          "דצמבר",
        ];

        if (maxMonth[1] > minMonth[1] * 2) {
          insights.push({
            icon: "📅",
            title: "עונתיות ברורה",
            text: `השיא ב${monthNames[maxMonth[0]]} והשפל ב${
              monthNames[minMonth[0]]
            }. תכנן מבצעים בחודשים החלשים, והעלה מחירים בעונות השיא.`,
          });
        }

        const insightsElement = document.getElementById("businessInsights");
        if (!insightsElement) {
          console.error("businessInsights element not found");
          return;
        }

        let html =
          '<div class="business-insights-container">';
        insights.forEach((insight) => {
          html += `
          <div class="insight-card">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-title">${insight.title}</div>
            <div class="insight-text">${insight.text}</div>
          </div>
        `;
        });
        html += "</div>";

        insightsElement.innerHTML = html;
      }

      async function loadAnalytics() {
        try {
          const { data: allOrders, error } = await supabase
            .from("orders")
            .select("*")
            .eq("status", "מאושר")
            .order("check_in", { ascending: true });

          if (error) throw error;

          // חישוב נתונים
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          // הכנסות החודש הנוכחי
          const thisMonthOrders = allOrders.filter((order) => {
            const checkIn = new Date(order.check_in);
            return (
              checkIn.getMonth() === currentMonth &&
              checkIn.getFullYear() === currentYear
            );
          });

          const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => {
            const days = calculateDays(order.check_in, order.check_out);
            const price = order.price_per_day || 130;
            return sum + days * price;
          }, 0);

          // הכנסות החודש הקודם
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastMonthYear =
            currentMonth === 0 ? currentYear - 1 : currentYear;

          const lastMonthOrders = allOrders.filter((order) => {
            const checkIn = new Date(order.check_in);
            return (
              checkIn.getMonth() === lastMonth &&
              checkIn.getFullYear() === lastMonthYear
            );
          });

          const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => {
            const days = calculateDays(order.check_in, order.check_out);
            const price = order.price_per_day || 130;
            return sum + days * price;
          }, 0);

          const revenueChange =
            lastMonthRevenue > 0
              ? (
                  ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) *
                  100
                ).toFixed(1)
              : 0;

          document.getElementById("monthlyRevenue").textContent =
            formatCurrency(thisMonthRevenue);
          document.getElementById("revenueChange").textContent = `${
            revenueChange > 0 ? "+" : ""
          }${revenueChange}% מהחודש הקודם`;
          document.getElementById("revenueChange").className = `stat-change ${
            revenueChange >= 0 ? "positive" : "negative"
          }`;

          // כלבים החודש
          const uniqueDogsThisMonth = new Set(
            thisMonthOrders.map((o) => o.dog_name)
          ).size;
          const uniqueDogsLastMonth = new Set(
            lastMonthOrders.map((o) => o.dog_name)
          ).size;
          const dogsChange =
            uniqueDogsLastMonth > 0
              ? (
                  ((uniqueDogsThisMonth - uniqueDogsLastMonth) /
                    uniqueDogsLastMonth) *
                  100
                ).toFixed(1)
              : 0;

          document.getElementById("monthlyDogs").textContent =
            uniqueDogsThisMonth;
          document.getElementById("dogsChange").textContent = `${
            dogsChange > 0 ? "+" : ""
          }${dogsChange}% מהחודש הקודם`;
          document.getElementById("dogsChange").className = `stat-change ${
            dogsChange >= 0 ? "positive" : "negative"
          }`;

          // תפוסה ממוצעת
          const daysInMonth = new Date(
            currentYear,
            currentMonth + 1,
            0
          ).getDate();
          let totalOccupancy = 0;

          for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(currentYear, currentMonth, day);
            const dogsOnDay = thisMonthOrders.filter((order) => {
              const checkIn = new Date(order.check_in);
              const checkOut = new Date(order.check_out);
              return currentDate >= checkIn && currentDate <= checkOut;
            }).length;
            totalOccupancy += dogsOnDay;
          }

          const avgOccupancy = (
            (totalOccupancy / daysInMonth / MAX_CAPACITY) *
            100
          ).toFixed(1);
          document.getElementById("avgOccupancy").textContent =
            avgOccupancy + "%";

          // צמיחה ושימור
          const uniqueCustomersAll = new Set(allOrders.map((o) => o.phone)).size;
          
          // חישוב לקוחות חוזרים (מעל הזמנה אחת)
          const customerOrderCounts = {};
          allOrders.forEach(o => {
            customerOrderCounts[o.phone] = (customerOrderCounts[o.phone] || 0) + 1;
          });
          const returningCustomersCount = Object.values(customerOrderCounts).filter(count => count > 1).length;
          const retentionRate = uniqueCustomersAll > 0 ? ((returningCustomersCount / uniqueCustomersAll) * 100).toFixed(1) : 0;

          const newCustomersThisMonth = new Set(
            thisMonthOrders
              .filter((order) => {
                const firstOrder = allOrders
                  .filter((o) => o.phone === order.phone)
                  .sort(
                    (a, b) => new Date(a.check_in) - new Date(b.check_in)
                  )[0];
                return (
                  new Date(firstOrder.check_in).getMonth() === currentMonth &&
                  new Date(firstOrder.check_in).getFullYear() === currentYear
                );
              })
              .map((o) => o.phone)
          ).size;

          document.getElementById("retentionRate").textContent = retentionRate + "%";
          document.getElementById("newCustomers").textContent = `${newCustomersThisMonth} לקוחות חדשים החודש`;

          // תחזית הכנסות - בהתבסס על ממוצע 3 חודשים אחרונים
          const revenueByMonth = {};
          allOrders.forEach((order) => {
            const checkIn = new Date(order.check_in);
            const monthKey = `${checkIn.getFullYear()}-${checkIn.getMonth()}`;
            if (!revenueByMonth[monthKey]) revenueByMonth[monthKey] = 0;
            const days = calculateDays(order.check_in, order.check_out);
            const price = order.price_per_day || 130;
            revenueByMonth[monthKey] += days * price;
          });

          const recentMonths = Object.values(revenueByMonth).slice(-3);
          const avgRevenue =
            recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length;
          const growthRate = 1.05; // הנחה של 5% צמיחה חודשית

          for (let i = 1; i <= 3; i++) {
            const futureMonth = new Date(currentYear, currentMonth + i, 1);
            const prediction = avgRevenue * Math.pow(growthRate, i);
            document.getElementById(`nextMonth${i}`).textContent =
              getMonthName(futureMonth.getMonth()) +
              " " +
              futureMonth.getFullYear();
            document.getElementById(`prediction${i}`).textContent =
              formatCurrency(Math.round(prediction));
          }

          // גרף הכנסות חודשיות
          const last6Months = [];
          const last6MonthsRevenue = [];

          for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(currentYear, currentMonth - i, 1);
            const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
            last6Months.push(getMonthName(monthDate.getMonth()));
            last6MonthsRevenue.push(revenueByMonth[monthKey] || 0);
          }

          new Chart(document.getElementById("revenueChart"), {
            type: "bar",
            data: {
              labels: last6Months,
              datasets: [
                {
                  label: "הכנסות (₪)",
                  data: last6MonthsRevenue,
                  backgroundColor: "rgba(102, 126, 234, 0.6)",
                  borderColor: "rgba(102, 126, 234, 1)",
                  borderWidth: 2,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function (value) {
                      return "₪" + value.toLocaleString();
                    },
                  },
                },
              },
            },
          });

          // גרף תפוסה
          const last6MonthsOccupancy = [];

          for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(currentYear, currentMonth - i, 1);
            const daysInThisMonth = new Date(
              monthDate.getFullYear(),
              monthDate.getMonth() + 1,
              0
            ).getDate();

            const monthOrders = allOrders.filter((order) => {
              const checkIn = new Date(order.check_in);
              return (
                checkIn.getMonth() === monthDate.getMonth() &&
                checkIn.getFullYear() === monthDate.getFullYear()
              );
            });

            let monthTotalOccupancy = 0;
            for (let day = 1; day <= daysInThisMonth; day++) {
              const currentDate = new Date(
                monthDate.getFullYear(),
                monthDate.getMonth(),
                day
              );
              const dogsOnDay = monthOrders.filter((order) => {
                const checkIn = new Date(order.check_in);
                const checkOut = new Date(order.check_out);
                return currentDate >= checkIn && currentDate <= checkOut;
              }).length;
              monthTotalOccupancy += dogsOnDay;
            }

            const monthAvgOccupancy = (
              (monthTotalOccupancy / daysInThisMonth / MAX_CAPACITY) *
              100
            ).toFixed(1);
            last6MonthsOccupancy.push(parseFloat(monthAvgOccupancy));
          }

          // גרף תפוסה - עמודות במקום קו
          new Chart(document.getElementById("occupancyChart"), {
            type: "bar",
            data: {
              labels: last6Months,
              datasets: [
                {
                  label: "תפוסה ממוצעת (%)",
                  data: last6MonthsOccupancy,
                  backgroundColor: "rgba(76, 175, 80, 0.8)",
                  borderColor: "rgba(76, 175, 80, 1)",
                  borderWidth: 2,
                  borderRadius: 8,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    callback: function (value) {
                      return value + "%";
                    },
                  },
                },
              },
              plugins: {
                legend: {
                  display: false,
                },
              },
            },
          });

          // לקוחות מובילים
          const customerStats = {};
          allOrders.forEach((order) => {
            if (!customerStats[order.phone]) {
              customerStats[order.phone] = {
                name: order.owner_name,
                phone: order.phone,
                orders: 0,
                revenue: 0,
              };
            }
            customerStats[order.phone].orders++;
            const days = calculateDays(order.check_in, order.check_out);
            const price = order.price_per_day || 130;
            customerStats[order.phone].revenue += days * price;
          });

          const topCustomers = Object.values(customerStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

          const tbody = document.querySelector("#topCustomersTable tbody");
          tbody.innerHTML = "";

          topCustomers.forEach((customer, index) => {
            const avgPerVisit = customer.revenue / customer.orders;
            const tr = document.createElement("tr");
            tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${customer.name}</td>
            <td><a href="https://wa.me/${customer.phone.replace(/\D/g, '').replace(/^0/, '972')}" target="_blank" style="color: #25D366; text-decoration: none; font-weight: bold;">${customer.phone} 💬</a></td>
            <td>${customer.orders}</td>
            <td><strong>${formatCurrency(customer.revenue)}</strong></td>
            <td>${formatCurrency(Math.round(avgPerVisit))}</td>
          `;
            tbody.appendChild(tr);
          });

          // פילוח לפי גודל
          const sizeBreakdown = {};
          allOrders.forEach((order) => {
            const size = order.dog_breed || "לא צוין";
            sizeBreakdown[size] = (sizeBreakdown[size] || 0) + 1;
          });

          let breedHtml = "";
          Object.entries(sizeBreakdown)
            .sort((a, b) => b[1] - a[1])
            .forEach(([size, count]) => {
              const percentage = ((count / allOrders.length) * 100).toFixed(1);
              breedHtml += `
              <div class="metric-row">
                <span class="metric-label">${size}</span>
                <span class="metric-value">${count} (${percentage}%)</span>
              </div>
            `;
            });
          document.getElementById("breedBreakdown").innerHTML = breedHtml;



          // ניתוח תובנות עסקיות
          generateBusinessInsights(
            allOrders,
            thisMonthRevenue,
            lastMonthRevenue,
            avgOccupancy,
            topCustomers,
            sizeBreakdown
          );

          // הסתר טעינה והצג דשבורד
          document.getElementById("loadingIndicator").style.display = "none";
          document.getElementById("dashboardContent").style.display = "block";
        } catch (error) {
          console.error("Error loading analytics:", error);
          document.getElementById("loadingIndicator").innerHTML =
            "❌ שגיאה בטעינת הנתונים: " + error.message;
        }
      }

      // טען נתונים בטעינת הדף
      loadAnalytics();
