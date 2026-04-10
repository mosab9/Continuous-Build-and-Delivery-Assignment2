package com.tus.orderservice.dto;
import lombok.Data;

import java.util.List;

@Data
public class PagedResponse<T> {
    private List<T> data;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;

    public static <T> PagedResponse<T> of(
            List<T> data, int page, int size, long totalElements) {
        PagedResponse<T> r = new PagedResponse<>();
        r.data          = data;
        r.page          = page;
        r.size          = size;
        r.totalElements = totalElements;
        r.totalPages    = (int) Math.ceil((double) totalElements / size);
        return r;
    }
}
