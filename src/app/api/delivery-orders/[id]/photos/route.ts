import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import {
  addDeliveryPhoto,
  deleteDeliveryPhoto,
} from "@/lib/actions/delivery-order.actions";
import { hasPermission } from "@/lib/utils/role";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/delivery-orders/[id]/photos
 * Daftar foto lampiran DO beserta ukuran dan metadatanya
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_DELIVERY_ORDERS")) return forbiddenResponse();

    const { id } = await context.params;

    const photos = await prisma.deliveryPhoto.findMany({
      where: { deliveryOrderId: id },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    });

    const totalSizeBytes = photos.reduce((acc, p) => acc + p.sizeBytes, 0);

    return successResponse({
      photos,
      totalCount: photos.length,
      totalSizeBytes,
    });
  } catch (error) {
    console.error("[API_DELIVERY_PHOTOS_GET_ERROR]", error);
    return errorResponse("Gagal mengambil data foto Surat Jalan");
  }
}

/**
 * POST /api/delivery-orders/[id]/photos
 * Menambahkan foto baru ke DO
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "UPDATE_DELIVERY_STATUS")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();

    const result = await addDeliveryPhoto({
      deliveryOrderId: id,
      url: body.url,
      filename: body.filename,
      sizeBytes: body.sizeBytes,
      mimeType: body.mimeType,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal menambahkan foto", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_DELIVERY_PHOTOS_POST_ERROR]", error);
    return errorResponse("Gagal memproses penambahan foto");
  }
}

/**
 * DELETE /api/delivery-orders/[id]/photos?photoId=xxx
 * Menghapus foto dari DB dan R2 sekaligus
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "UPDATE_DELIVERY_STATUS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("photoId");

    if (!photoId) {
      return errorResponse("Parameter photoId wajib diisi", 400);
    }

    const result = await deleteDeliveryPhoto(photoId);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus foto", 400);
    }

    return successResponse({}, result.message);
  } catch (error) {
    console.error("[API_DELIVERY_PHOTOS_DELETE_ERROR]", error);
    return errorResponse("Gagal memproses penghapusan foto");
  }
}
