<?php
require_once __DIR__ . '/../app/bootstrap.php';

header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";

$baseUrl = 'https://bluegatestore.online';
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc><?= htmlspecialchars($baseUrl) ?>/</loc>
    <lastmod><?= date('Y-m-d') ?></lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc><?= htmlspecialchars($baseUrl) ?>/web/</loc>
    <lastmod><?= date('Y-m-d') ?></lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>

  <?php
  // Active Categories
  try {
      $categories = shop_categories(false);
      foreach ($categories as $cat) {
          echo "  <url>\n";
          echo "    <loc>" . htmlspecialchars($baseUrl . '/web/#cat-' . $cat['id']) . "</loc>\n";
          echo "    <changefreq>weekly</changefreq>\n";
          echo "    <priority>0.7</priority>\n";
          echo "  </url>\n";
      }
  } catch (Throwable $e) {}

  // Active Products
  try {
      $products = shop_products(null, true);
      foreach ($products as $p) {
          $date = !empty($p['updated_at']) ? date('Y-m-d', strtotime($p['updated_at'])) : date('Y-m-d');
          echo "  <url>\n";
          echo "    <loc>" . htmlspecialchars($baseUrl . '/web/#product-' . $p['id']) . "</loc>\n";
          echo "    <lastmod>" . $date . "</lastmod>\n";
          echo "    <changefreq>daily</changefreq>\n";
          echo "    <priority>0.8</priority>\n";
          echo "  </url>\n";
      }
  } catch (Throwable $e) {}
  ?>
</urlset>
